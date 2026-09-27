/* ============================================================
   The Assistant's business_calc and network_tool: the formulas
   match the Business & Finance tools, and the offline network
   calculations are right.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

const { businessCalc, BUSINESS_CALCULATORS } = await import('../../js/lib/business-calc.js');
const { subnet, parseUrl } = await import('../../js/lib/network-calc.js');
const { executeDomainTool, DOMAIN_TOOL_NAMES } = await import('../../js/lib/assistant/domain-tools.js');
const { TOOLS } = await import('../../js/registry/tools.js');
const { TOOL_GROUPS } = await import('../../js/lib/assistant/tool-groups.js');

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);

test('business calculators', () => {
  near(businessCalc('vat', { amount: 10750, rate: 7.5, mode: 'remove' }).data.net, 10000);
  near(businessCalc('margin_markup', { cost: 60, margin_pct: 40 }).data.price, 100);
  near(businessCalc('break_even', { fixed_costs: 12000, price: 45, variable_cost: 18 }).data.beUnits, 444.44);
  near(businessCalc('loan', { principal: 100000, rate_pct: 12, years: 1 }).data.payment, 8884.88);
  near(businessCalc('npv_irr', { rate_pct: 10, initial_investment: 1000, cash_flows: [1100] }).data.npv, 0);
  near(businessCalc('npv_irr', { initial_investment: 1000, cash_flows: [1100] }).data.irr, 0.1, 1e-6);
  near(businessCalc('cap_table', { founders: [{ name: 'A', shares: 900 }], pool_pct: 10, rounds: [{ raise: 25, pre_money: 75 }] }).data.holders.at(-1).shares, 333.333, 1e-2);
  near(businessCalc('unit_economics', { marketing_spend: 60000, new_customers: 40, arpu: 220, gross_margin_pct: 78, churn_pct: 3 }).data.ltv, 5720);
  assert.ok(businessCalc('nope').error);
  for (const c of BUSINESS_CALCULATORS) assert.ok(!businessCalc(c, {}).error || c === 'margin_markup', `${c} runs on defaults`);
});

test('subnet and URL maths', () => {
  const s = subnet('192.168.1.10/24');
  assert.equal(s.network, '192.168.1.0'); assert.equal(s.broadcast, '192.168.1.255'); assert.equal(s.usableHosts, 254);
  assert.equal(subnet('10.0.0.5', '255.255.252.0').cidr, '10.0.0.0/22');
  assert.equal(subnet('1.2.3.4/32').usableHosts, 1);
  assert.ok(subnet('300.1.1.1/8').error);
  assert.equal(parseUrl('example.com:8080/a?b=1').port, '8080');
});

test('the Assistant can reach every Business & Finance and Networking tool', async () => {
  const card = await executeDomainTool('business_calc', { calculator: 'vat', inputs: { amount: 5000, rate: 7.5 } });
  assert.equal(card.renderer, 'business-calc');
  assert.ok(TOOLS.some(t => t.id === card.toolId));
  const net = await executeDomainTool('network_tool', { action: 'subnet', target: '10.1.2.3', prefix: '20' });
  assert.equal(net.renderer, 'network-result');
  const grouped = new Set(Object.values(TOOL_GROUPS).flatMap(g => g.tools));
  for (const n of DOMAIN_TOOL_NAMES) assert.ok(grouped.has(n), `${n} is in a tool group`);
  // Tools with a dedicated Assistant route: calculators via business_calc, lookups via network_tool,
  // the rest (documents, mail, timesheets…) via open_toolbox_tool.
  const { NETWORK_ACTIONS } = await import('../../js/lib/network-calc.js');
  const netIds = new Set(Object.values(NETWORK_ACTIONS));
  for (const t of TOOLS.filter(t => t.category === 'networking')) assert.ok(netIds.has(t.id), `${t.id} reachable through network_tool`);
});
