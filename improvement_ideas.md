# Ideas

## Day 1
So, first thing I noticed is that they have a pretty trash way of getting streams of data(at least that's what they are doing in the simple_training), they would take 1 hour candles, and also pretty old values, from about 2025, so there's a lot of area of improvement in that departament. We coudl swap for 1 minute candles for 1 month, and that should be a lot more descriptive for the model. Their model also does a lot of trades, which is fucked because of the comission. We could have something like buying only when the feeling is > 80%, in order to avoid comissions and to maximise profit on shorter term trades, like 1 or 2 minutes maximum. Of course, by that we would need to use pretty much a lot more capital for a singular trade.

## Day 2

First idea of the day: how can i improve the reward function? So in tensortrade, they use pretty much the PBR (Position-Based Returns)

```python
def reward(env):
    return price_change * position  # +1 for long, -1 for cash
```

But, in case we want it to make more trades and short term ones, how can he learn that this is wrong, while he basically takes the right decissions?

My idea was that in order to improve the reward function, we can reward the model while doing the trade, so while in HOLD, but also at the end of the trade, in case he did good selling at that point or not. This way I believe he may develop a strategy where he correlates the P&L with the fee paid in order to start the trade. Basically, it should realise the comission paid for the trade is pretty much 0.25% of the value of the trade or whatever, and try and make trades that can cover this cost. I believe this may be a big piece the guys in tensortrade missed.