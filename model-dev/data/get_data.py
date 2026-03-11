from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame
from datetime import datetime
from cyclopts import App

class DownloadData:
    def __init__(self, tickers, timeframe: TimeFrame, startdate: datetime):
        self.tickers = tickers
        self.timeframe = timeframe
        self.startdate = startdate
    
    def fetch(self):
        client = StockHistoricalDataClient("PKRUT554WVBY2CQV2XY7EG6HTY", "FzZfBvstVyk1mgFDAufDGEsZGncr9xX6CYKCNEwhC15T")

        request_params = StockBarsRequest(
            symbol_or_symbols=self.tickers,
            timeframe=self.timeframe,
            start=self.startdate
        )

        bars = client.get_stock_bars(request_params)
        return bars.df

app = App()

@app.default
def main(training_data_path: str,
        tickers: list[str] = ["QQQ"],
        timeframe: TimeFrame = TimeFrame.Minute,
        startdate: datetime = datetime(2025, 1, 1)):
    # change startdate in years, months, days and timeframe in minutes or hours for the user to input
    cdd = DownloadData(tickers, timeframe, startdate)
    data = cdd.fetch()
    data.to_csv(training_data_path)

if __name__ == "__main__":
    app()
    