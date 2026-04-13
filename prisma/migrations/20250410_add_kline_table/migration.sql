-- CreateTable
CREATE TABLE [t_StockKLine] (
    [StockCode] NVARCHAR(50) NOT NULL,
    [Period] NVARCHAR(10) NOT NULL,
    [TradeTime] DATETIME NOT NULL,
    [OpenPrice] DECIMAL(10,2),
    [ClosePrice] DECIMAL(10,2),
    [HighPrice] DECIMAL(10,2),
    [LowPrice] DECIMAL(10,2),
    [Volume] DECIMAL(18,2),
    [Turnover] DECIMAL(18,2),
    [Amplitude] DECIMAL(8,4),
    [ChangeRate] DECIMAL(8,4),
    [ChangeAmount] DECIMAL(10,2),
    [TurnoverRate] DECIMAL(8,4),
    CONSTRAINT [PK_t_StockKLine] PRIMARY KEY ([StockCode], [Period], [TradeTime])
);

-- CreateIndex
CREATE INDEX [IX_t_StockKLine_Query] ON [t_StockKLine]([StockCode], [Period], [TradeTime]);
