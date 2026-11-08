import assert from 'node:assert/strict';
import test from 'node:test';
import {metricPeriod,shiftMetricPeriod,metricBucketLabel} from '../admin/metric-period.js';
test('calendar periods use Monday weeks and leap-year month ends',()=>{
 assert.deepEqual(metricPeriod('day','2026-11-09'),{start:'2026-11-09',end:'2026-11-09'});
 assert.deepEqual(metricPeriod('week','2026-11-08'),{start:'2026-11-02',end:'2026-11-08'});
 assert.deepEqual(metricPeriod('week','2026-11-09'),{start:'2026-11-09',end:'2026-11-15'});
 assert.deepEqual(metricPeriod('month','2024-02-29'),{start:'2024-02-01',end:'2024-02-29'});
 assert.deepEqual(shiftMetricPeriod('month','2026-01-01','2026-01-31',-1),{start:'2025-12-01',end:'2025-12-31'});
 assert.deepEqual(shiftMetricPeriod('week','2026-12-28','2027-01-03',1),{start:'2027-01-04',end:'2027-01-10'});
 assert.deepEqual(shiftMetricPeriod('custom','2026-11-01','2026-11-03',1),{start:'2026-11-04',end:'2026-11-06'});
});
test('hour labels distinguish dates across a weekly or monthly timeline',()=>{
 assert.equal(metricBucketLabel('2026-11-09 03:00','hour',true,true),'03:00');
 assert.equal(metricBucketLabel('2026-11-09 03:00','hour',true,false),'11.09 03:00');
 assert.equal(metricBucketLabel('2026-11-09 03:00','hour'),'2026.11.09 03:00');
});
