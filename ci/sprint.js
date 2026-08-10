const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const MILLISECONDS_PER_SPRINT = 3 * MILLISECONDS_PER_WEEK;
// Sprint 267 started at this UTC instant, establishing the fixed three-week cadence.
const SPRINT_EPOCH_NUMBER = 267;
const SPRINT_EPOCH_START = Date.parse('2025-11-29T00:00:00.000Z');

function getSprintInfo(date = new Date()) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
        throw new TypeError('Sprint calculation requires a valid date.');
    }

    const elapsedMilliseconds = date.getTime() - SPRINT_EPOCH_START;
    const sprintOffset = Math.floor(elapsedMilliseconds / MILLISECONDS_PER_SPRINT);
    const sprintStart = SPRINT_EPOCH_START + sprintOffset * MILLISECONDS_PER_SPRINT;
    const week = Math.floor((date.getTime() - sprintStart) / MILLISECONDS_PER_WEEK) + 1;

    return {
        sprint: SPRINT_EPOCH_NUMBER + sprintOffset,
        week
    };
}

function getSprintDates(sprint) {
    if (!Number.isInteger(sprint) || sprint <= 0) {
        throw new TypeError('Sprint must be a positive integer.');
    }

    const sprintStart = SPRINT_EPOCH_START
        + (sprint - SPRINT_EPOCH_NUMBER) * MILLISECONDS_PER_SPRINT;
    const weeks = {};

    for (let week = 1; week <= 3; week++) {
        const weekStart = sprintStart + (week - 1) * MILLISECONDS_PER_WEEK;
        weeks[week] = {
            start: new Date(weekStart).toISOString(),
            end: new Date(weekStart + MILLISECONDS_PER_WEEK - 1).toISOString()
        };
    }

    return {
        sprint,
        start: new Date(sprintStart).toISOString(),
        end: new Date(sprintStart + MILLISECONDS_PER_SPRINT - 1).toISOString(),
        weeks
    };
}

if (require.main === module) {
    const sprintArgumentIndex = process.argv.indexOf('--sprint');

    try {
        const result = sprintArgumentIndex === -1
            ? getSprintInfo()
            : getSprintDates(Number(process.argv[sprintArgumentIndex + 1]));
        console.log(JSON.stringify(result));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

module.exports = {
    getSprintDates,
    getSprintInfo
};
