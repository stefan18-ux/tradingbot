from flask import Flask, jsonify
from dotenv import load_dotenv
import os
from pathlib import Path
from database.models import db
from routes.users import users_bp
from routes.trades import trades_bp
from routes.sessions import sessions_bp
from routes.model import model_bp
from routes.trading import trading_bp
from trading_execution import resume_active_trading_loops
from flask_migrate import Migrate
from flask_cors import CORS

load_dotenv(Path(__file__).resolve().parent / ".env", override=True)

migrate = Migrate()


def create_app():
    app = Flask(__name__, instance_relative_config=False)

    CORS(app)

    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
        'DATABASE_URL', 'mysql+pymysql://user:password@127.0.0.1:3306/tradingbot'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)
    migrate.init_app(app, db)
    
    app.register_blueprint(users_bp)
    app.register_blueprint(trades_bp)
    app.register_blueprint(sessions_bp)
    app.register_blueprint(model_bp)
    app.register_blueprint(trading_bp)

    @app.route('/health')
    def health():
        return jsonify({'status': 'ok'})

    if (
        os.environ.get("WERKZEUG_RUN_MAIN") == "true"
        or os.getenv("ENABLE_TRADING_LOOP_RESUME", "false").lower() == "true"
    ):
        resume_active_trading_loops(app)

    return app

if __name__ == '__main__':
    create_app().run(host='0.0.0.0', port=5000, debug=True)
