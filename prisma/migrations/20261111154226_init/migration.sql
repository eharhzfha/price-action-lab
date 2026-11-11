-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL DEFAULT 'NQ1!',
    "instrument" TEXT NOT NULL DEFAULT 'NQ',
    "direction" TEXT NOT NULL,
    "entryPrice" REAL NOT NULL,
    "exitPrice" REAL,
    "quantity" INTEGER NOT NULL,
    "entryTime" DATETIME NOT NULL,
    "exitTime" DATETIME,
    "stopPrice" REAL,
    "targetPrice" REAL,
    "fees" REAL NOT NULL DEFAULT 0,
    "slippage" REAL NOT NULL DEFAULT 0,
    "pnl" REAL,
    "rMultiple" REAL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "setupGrade" TEXT,
    "notes" TEXT,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BacktestRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "datasetName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "configJson" TEXT NOT NULL,
    "metricsJson" TEXT NOT NULL,
    "tradesJson" TEXT NOT NULL,
    "equityJson" TEXT NOT NULL,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "winRate" REAL NOT NULL DEFAULT 0,
    "profitFactor" REAL NOT NULL DEFAULT 0,
    "expectancyR" REAL NOT NULL DEFAULT 0,
    "maxDrawdown" REAL NOT NULL DEFAULT 0,
    "netPnl" REAL NOT NULL DEFAULT 0,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "emotion" TEXT,
    "discipline" INTEGER NOT NULL DEFAULT 3,
    "lessons" TEXT,
    "tags" TEXT,
    "tradeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JournalEntry_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "defaultInstrument" TEXT NOT NULL DEFAULT 'NQ',
    "accountSize" REAL NOT NULL DEFAULT 100000,
    "riskPct" REAL NOT NULL DEFAULT 1,
    "commissionPerSide" REAL NOT NULL DEFAULT 2.5,
    "slippageTicks" REAL NOT NULL DEFAULT 1,
    "observationStart" TEXT NOT NULL DEFAULT '09:50',
    "observationEnd" TEXT NOT NULL DEFAULT '10:10',
    "defaultRR" REAL NOT NULL DEFAULT 2,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PaperAccount" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "name" TEXT NOT NULL DEFAULT 'Paper Account',
    "startingBalance" REAL NOT NULL DEFAULT 100000,
    "balance" REAL NOT NULL DEFAULT 100000,
    "equity" REAL NOT NULL DEFAULT 100000,
    "stateJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Trade_entryTime_idx" ON "Trade"("entryTime");

-- CreateIndex
CREATE INDEX "Trade_source_idx" ON "Trade"("source");

-- CreateIndex
CREATE INDEX "JournalEntry_date_idx" ON "JournalEntry"("date");
