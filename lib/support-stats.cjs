const SERVER_GOAL_USD = 5;

function readSupportFields(parsed) {
  return {
    supportServerFundUsd: Math.max(0, Number(parsed?.supportServerFundUsd) || 0),
    supportTelegramStarsTotal: Math.max(0, Math.floor(Number(parsed?.supportTelegramStarsTotal) || 0)),
  };
}

function publicSupportStats(db) {
  return {
    serverFundUsd: Math.max(0, Number(db?.supportServerFundUsd) || 0),
    serverGoalUsd: SERVER_GOAL_USD,
    telegramStarsTotal: Math.max(0, Math.floor(Number(db?.supportTelegramStarsTotal) || 0)),
  };
}

module.exports = { SERVER_GOAL_USD, readSupportFields, publicSupportStats };
