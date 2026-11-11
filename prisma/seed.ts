import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DAY = 86400000;

function at(daysAgo: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return new Date(d.getTime() - daysAgo * DAY);
}

async function main() {
  await prisma.userSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      defaultInstrument: "MNQ",
      accountSize: 100000,
      riskPct: 1,
      commissionPerSide: 2.5,
      slippageTicks: 1,
      observationStart: "09:50",
      observationEnd: "10:10",
      defaultRR: 2,
      timezone: "America/New_York",
    },
  });

  await prisma.paperAccount.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      name: "Paper Account",
      startingBalance: 100000,
      balance: 100000,
      equity: 100000,
      stateJson: JSON.stringify({ positions: [], orders: [], fills: [], dayRealized: 0 }),
    },
  });

  const tradeCount = await prisma.trade.count();
  if (tradeCount > 0) {
    console.log(`Seed skipped: ${tradeCount} trades already present.`);
    return;
  }

  const trades = [
    {
      symbol: "NQ1!",
      instrument: "MNQ",
      direction: "LONG",
      entryPrice: 18412.25,
      exitPrice: 18468.5,
      quantity: 8,
      entryTime: at(1, 9, 58),
      exitTime: at(1, 10, 34),
      stopPrice: 18388.25,
      targetPrice: 18460.25,
      fees: 40,
      slippage: 4,
      pnl: 818,
      rMultiple: 1.74,
      source: "PAPER",
      setupGrade: "A",
      notes: "London low swept, 5M BOS aligned with 4H/1H. Held to 2R target.",
      tags: "A+ setup,London sweep",
    },
    {
      symbol: "NQ1!",
      instrument: "MNQ",
      direction: "SHORT",
      entryPrice: 18344.5,
      exitPrice: 18321.75,
      quantity: 12,
      entryTime: at(3, 10, 2),
      exitTime: at(3, 10, 40),
      stopPrice: 18368.5,
      targetPrice: 18296.5,
      fees: 60,
      slippage: 6,
      pnl: 214,
      rMultiple: 0.72,
      source: "LIVE",
      setupGrade: "B",
      notes: "Took partial at 1R. Should have let the runner work.",
      tags: "early exit,discipline",
    },
    {
      symbol: "NQ1!",
      instrument: "NQ",
      direction: "LONG",
      entryPrice: 18102.0,
      exitPrice: 18072.5,
      quantity: 1,
      entryTime: at(6, 9, 57),
      exitTime: at(6, 10, 12),
      stopPrice: 18072.5,
      targetPrice: 18161.0,
      fees: 5,
      slippage: 5,
      pnl: -635,
      rMultiple: -1.0,
      source: "MANUAL",
      setupGrade: "C",
      notes: "Chased the third push after the observation window. Clear FOMO.",
      tags: "FOMO,outside window",
    },
    {
      symbol: "MNQ1!",
      instrument: "MNQ",
      direction: "SHORT",
      entryPrice: 18270.25,
      exitPrice: 18208.5,
      quantity: 6,
      entryTime: at(8, 9, 59),
      exitTime: at(8, 11, 5),
      stopPrice: 18296.25,
      targetPrice: 18218.25,
      fees: 30,
      slippage: 3,
      pnl: 710,
      rMultiple: 1.92,
      source: "BACKTEST",
      setupGrade: "A+",
      notes: "Model trade from the 15M conflict-resolution playbook.",
      tags: "conflict,15M BOS",
    },
    {
      symbol: "MNQ1!",
      instrument: "MNQ",
      direction: "LONG",
      entryPrice: 18541.0,
      exitPrice: 18525.5,
      quantity: 10,
      entryTime: at(11, 10, 4),
      exitTime: at(11, 10, 18),
      stopPrice: 18525.5,
      targetPrice: 18572.0,
      fees: 50,
      slippage: 5,
      pnl: -205,
      rMultiple: -1.0,
      source: "PAPER",
      setupGrade: "B",
      notes: "Late session entry, no fresh sweep. Process error, not a strategy error.",
      tags: "process,late entry",
    },
  ];

  const created = [];
  for (const trade of trades) {
    created.push(await prisma.trade.create({ data: trade }));
  }

  const journal = [
    {
      date: at(1, 16, 15),
      title: "Executed the London sweep exactly as planned",
      content:
        "4H and 1H were aligned bullish. Price swept the London low at 09:38, left a clean 1M FVG, and tapped it at 09:54. I waited for the 1M BOS instead of front-running the level. Entry 09:58, stop below the POI, target 2R. The checklist kept me patient.",
      emotion: "CALM",
      discipline: 5,
      lessons: "The observation window filter removes the low-quality 09:35 impulse entries.",
      tags: "execution,patience",
      tradeId: created[0].id,
    },
    {
      date: at(3, 17, 0),
      title: "Cut a winner too early",
      content:
        "I exited at 0.72R because the tape felt heavy, even though the checklist was still valid. The trade eventually reached 2R. Emotion overrode the plan.",
      emotion: "ANXIOUS",
      discipline: 3,
      lessons: "Either take a pre-planned partial or hold to target. No discretionary scratch.",
      tags: "early exit,emotion",
      tradeId: created[1].id,
    },
    {
      date: at(6, 16, 40),
      title: "FOMO after the window",
      content:
        "Entered at 10:12 after the observation window closed. The setup was no longer valid. One full NQ point-based stop later, I have a reminder that the window is a hard gate.",
      emotion: "FRUSTRATED",
      discipline: 1,
      lessons: "Hard rule: no new entries after 10:10 ET. Replay the session instead.",
      tags: "FOMO,rules",
      tradeId: created[2].id,
    },
    {
      date: at(9, 15, 30),
      title: "Weekly process review",
      content:
        "9 modelled setups across 20 sessions. Losses were both trap days that still passed the structural checklist. The edge is in the R:R and selectivity, not in a high hit rate. Keep risk at 1% and avoid adding to losers.",
      emotion: "NEUTRAL",
      discipline: 4,
      lessons: "Two losses at -1R are inside the expected distribution. Do not widen stops.",
      tags: "review,expectancy",
    },
  ];

  for (const entry of journal) {
    await prisma.journalEntry.create({ data: entry });
  }

  console.log(`Seeded ${created.length} trades and ${journal.length} journal entries.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
