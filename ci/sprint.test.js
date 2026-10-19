const assert = require('node:assert/strict');
const test = require('node:test');

const { getSprintDates, getSprintInfo } = require('./sprint');

test('getSprintInfo calculates the sprint and week in UTC', () => {
    assert.deepEqual(getSprintInfo(new Date('2025-11-29T00:00:00.000Z')), { sprint: 267, week: 1 });
    assert.deepEqual(getSprintInfo(new Date('2025-12-05T23:59:59.999Z')), { sprint: 267, week: 1 });
    assert.deepEqual(getSprintInfo(new Date('2025-12-06T00:00:00.000Z')), { sprint: 267, week: 2 });
    assert.deepEqual(getSprintInfo(new Date('2025-12-13T00:00:00.000Z')), { sprint: 267, week: 3 });
    assert.deepEqual(getSprintInfo(new Date('2025-12-20T00:00:00.000Z')), { sprint: 268, week: 1 });
    assert.deepEqual(getSprintInfo(new Date('2025-11-28T23:59:59.999Z')), { sprint: 266, week: 3 });
});

test('getSprintDates returns the sprint date range and weekly ranges', () => {
    assert.deepEqual(getSprintDates(267), {
        sprint: 267,
        start: '2025-11-29T00:00:00.000Z',
        end: '2025-12-19T23:59:59.999Z',
        weeks: {
            1: {
                start: '2025-11-29T00:00:00.000Z',
                end: '2025-12-05T23:59:59.999Z'
            },
            2: {
                start: '2025-12-06T00:00:00.000Z',
                end: '2025-12-12T23:59:59.999Z'
            },
            3: {
                start: '2025-12-13T00:00:00.000Z',
                end: '2025-12-19T23:59:59.999Z'
            }
        }
    });
});

test('sprint helpers reject invalid inputs', () => {
    assert.throws(() => getSprintInfo(new Date('invalid')), /valid date/);
    assert.throws(() => getSprintDates(0), /positive integer/);
    assert.throws(() => getSprintDates(1.5), /positive integer/);
});
