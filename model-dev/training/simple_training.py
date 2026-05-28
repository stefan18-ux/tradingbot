import os
import sys
from pathlib import Path

MODEL_DEV_PATH = Path(__file__).resolve().parent.parent

os.environ.setdefault("MPLCONFIGDIR", "/tmp/matplotlib")
os.environ["PYTHONPATH"] = (
    f"{MODEL_DEV_PATH}{os.pathsep}{os.environ.get('PYTHONPATH', '')}"
)

import ray
import numpy as np
import pandas as pd
import gymnasium as gym
from sklearn.model_selection import train_test_split
from ray.tune.registry import register_env
from ray.rllib.algorithms.ppo import PPOConfig

sys.path.insert(0, str(MODEL_DEV_PATH))

from tensortrade.feed.core import DataFeed, Stream
from tensortrade.oms.exchanges import Exchange, ExchangeOptions
from oms.instruments import USD, QQQ
from tensortrade.oms.services.execution.simulated import execute_order
from tensortrade.oms.wallets import Wallet, Portfolio
from tensortrade.env.default.actions import BSH
from tensortrade.env.default.rewards import PBR
import tensortrade.env.default as default

from features.feature_extraction import extract, get_feature_cols
from cyclopts import App
from export_model import main as export_model

app = App()

class GymCompatWrapper:
    def __init__(self, env, observation_space, action_space, portfolio, max_steps=2000):
        self.env = env
        self.observation_space = observation_space
        self.action_space = action_space
        self.portfolio = portfolio
        self.max_steps = max_steps
        self.current_step = 0

    def reset(self, seed=None, options=None):
        self.current_step = 0
        reset_result = self.env.reset()
        obs = reset_result[0] if isinstance(reset_result, tuple) else reset_result
        return obs, {}

    def step(self, action):
        self.current_step += 1
        step_result = self.env.step(action)
        if len(step_result) == 5:
            obs, reward, done, truncated, info = step_result
        else:
            obs, reward, done, info = step_result
            truncated = False
        if self.current_step >= self.max_steps:
            done = True
        return obs, reward, done, truncated, info

def create_env(config: dict):
    data = pd.read_csv(config["csv_filename"])

    price = Stream.source(list(data["close"]), dtype="float").rename("USD-QQQ")
    
    exchange = Exchange("exchange", service=execute_order,
                       options=ExchangeOptions(commission=config.get("commission", 0)))(price)
    cash = Wallet(exchange, config.get("initial_cash", 10000) * USD)
    asset = Wallet(exchange, 0 * QQQ)
    portfolio = Portfolio(USD, [cash, asset])
    
    feature_streams = [Stream.source(list(data[c]), dtype="float").rename(c)
                      for c in config.get("feature_cols", [])]
    feed = DataFeed(feature_streams)
    feed.compile()
    
    reward_scheme = PBR(price=price)
    action_scheme = BSH(cash=cash, asset=asset).attach(reward_scheme)
    
    env = default.create(
        feed=feed,
        portfolio=portfolio,
        action_scheme=action_scheme,
        reward_scheme=reward_scheme,
        window_size=config.get("window_size", 30),
        max_allowed_loss=config.get("max_allowed_loss", 0.4)
    )
    
    reset_result = env.reset()
    obs = reset_result[0] if isinstance(reset_result, tuple) else reset_result
    observation_space = gym.spaces.Box(
        low=-np.inf, high=np.inf, shape=obs.shape, dtype=np.float32
    )
    action_space = action_scheme.action_space

    wrapped = GymCompatWrapper(env, observation_space, action_space, portfolio, 
                           max_steps=config.get("max_episode_steps", 2000))
    return wrapped

def evaluate(algo, data: pd.DataFrame, config: dict, n: int = 10) -> float:
    csv = '/tmp/val.csv'
    data.to_csv(csv, index=False)
    
    eval_config = {**config, "csv_filename": csv}
    
    pnls = []
    for _ in range(n):
        env = create_env(eval_config)
        obs, _ = env.reset()
        done = truncated = False
        while not done and not truncated:
            action = algo.compute_single_action(obs)
            obs, reward, done, truncated, info = env.step(action)
        pnls.append(env.portfolio.net_worth - config.get("initial_cash", 10000))
    
    os.remove(csv)
    return float(np.mean(pnls))

@app.default
def main(
    training_data_path: str,
    max_allowed_loss: float = 0.4,
    commission: float = 0.001,
    capital: float = 10000,
    iterations: int = 10,
    checkpoint_dir: str = "best_qqq_model",
):
    data = pd.read_csv(training_data_path)
    
    for col in ["timestamp", "symbol"]:
        if col in data.columns:
            data.drop(columns=[col], inplace=True)
    
    data = extract(data)

    train, temp = train_test_split(data, test_size=0.3, shuffle=False)
    validation, test = train_test_split(temp, test_size=0.8, shuffle=False)
    
    train.to_csv('/tmp/train.csv', index=False)
    
    config = {
        "csv_filename": '/tmp/train.csv',
        "feature_cols": get_feature_cols(),
        "window_size": 30,
        "max_allowed_loss": max_allowed_loss,
        "commission": commission,
        "initial_cash": capital,
        "max_episode_steps": 2000,
    }
    
    ray.init(
        num_cpus=6,
        ignore_reinit_error=True,
        log_to_driver=False,
        runtime_env={"env_vars": {"PYTHONPATH": os.environ["PYTHONPATH"]}},
    )
    register_env("TradingEnv", create_env)
    
    ppo_config = (
        PPOConfig()
        .api_stack(enable_rl_module_and_learner=False, enable_env_runner_and_connector_v2=False)
        .environment(env="TradingEnv", env_config=config)
        .framework("torch")
        .env_runners(num_env_runners=1)
        .training(
            lr=3.29e-05,
            gamma=0.992,
            lambda_=0.9,
            clip_param=0.123,
            entropy_coeff=0.015,
            train_batch_size=4000,
            minibatch_size=256,
            num_epochs=7,
            vf_clip_param=100.0,
            model={"fcnet_hiddens": [128, 128], "fcnet_activation": "tanh"},
        )
        .resources(num_gpus=0)
    )

    algo = ppo_config.build()
    
    best_val = float('-inf')
    best_iter = 0
    checkpoint_path = Path(checkpoint_dir)

    for i in range(iterations):
        result = algo.train()

        pnl = result.get('env_runners', {}).get('episode_reward_mean', 0)
        should_validate = (i + 1) == 1 or (i + 1) % 10 == 0 or (i + 1) == iterations
        if should_validate:
            val_pnl = evaluate(algo, validation, config, n=3)

            if val_pnl > best_val:
                best_val = val_pnl
                best_iter = i + 1
                algo.save(str(checkpoint_path))

            for key in result.get('env_runners', {}).keys():
                print(f"{key} : {result.get('env_runners', {})[key]}")

            print(f"  Iter {i+1:3d}: Train reward {pnl:+.6f}, Validation P&L ${val_pnl:+,.0f} (best ${best_val:+,.0f} @iter {best_iter})")

    if best_iter == 0:
        algo.save(str(checkpoint_path))
    export_model(str(checkpoint_path))

    algo.stop()
    ray.shutdown()

if __name__ == "__main__":
    app()
