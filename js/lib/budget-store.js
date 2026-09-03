/* ============================================================
   TOOLBOX — Budget & Transaction Store
   Authoritative source of truth for personal finances, transactions,
   spending analysis, debts, and bank statement imports.
   ============================================================ */

export const STORAGE_KEY_BUDGET = 'toolbox_budget_v1';

export const DEFAULT_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transportation',
  'Housing & Rent',
  'Utilities',
  'Entertainment',
  'Health & Medical',
  'Shopping',
  'Education',
  'Income & Salary',
  'Debt Repayment',
  'Miscellaneous'
];

function getInitialState() {
  return {
    transactions: [],
    budgets: {},
    debts: []
  };
}

/**
 * Load budget state from localStorage.
 * Guaranteed to return an empty state if no data is stored (NO PLACEHOLDER DATA).
 */
export function loadBudgetState() {
  try {
    if (typeof localStorage === 'undefined') return getInitialState();
    const raw = localStorage.getItem(STORAGE_KEY_BUDGET);
    if (!raw) return getInitialState();
    const parsed = JSON.parse(raw);
    return {
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      budgets: (parsed.budgets && typeof parsed.budgets === 'object') ? parsed.budgets : {},
      debts: Array.isArray(parsed.debts) ? parsed.debts : []
    };
  } catch (err) {
    console.error('[BudgetStore] Failed to load budget state:', err);
    return getInitialState();
  }
}

/**
 * Persist budget state to localStorage.
 */
export function saveBudgetState(state) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_BUDGET, JSON.stringify(state));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toolbox:budgetchange', { detail: state }));
    }
  } catch (err) {
    console.error('[BudgetStore] Failed to save budget state:', err);
  }
}

/**
 * Normalize category matching.
 */
export function normalizeCategory(cat) {
  if (!cat || typeof cat !== 'string') return 'Miscellaneous';
  const lower = cat.toLowerCase().trim();
  if (lower.includes('food') || lower.includes('eat') || lower.includes('restaur') || lower.includes('snack') || lower.includes('lunch') || lower.includes('dinner')) {
    return 'Food & Dining';
  }
  if (lower.includes('groc') || lower.includes('supermarket') || lower.includes('market') || lower.includes('mart') || lower.includes('shoprite')) {
    return 'Groceries';
  }
  if (lower.includes('uber') || lower.includes('bolt') || lower.includes('transit') || lower.includes('bus') || lower.includes('fuel') || lower.includes('transport') || lower.includes('gas')) {
    return 'Transportation';
  }
  if (lower.includes('rent') || lower.includes('house') || lower.includes('mortgage') || lower.includes('home')) {
    return 'Housing & Rent';
  }
  if (lower.includes('util') || lower.includes('electric') || lower.includes('water') || lower.includes('internet') || lower.includes('wifi') || lower.includes('bill')) {
    return 'Utilities';
  }
  if (lower.includes('movie') || lower.includes('netflix') || lower.includes('game') || lower.includes('entertain') || lower.includes('music')) {
    return 'Entertainment';
  }
  if (lower.includes('health') || lower.includes('med') || lower.includes('doctor') || lower.includes('pharm') || lower.includes('drug')) {
    return 'Health & Medical';
  }
  if (lower.includes('salary') || lower.includes('wage') || lower.includes('payroll') || lower.includes('income') || lower.includes('dividend')) {
    return 'Income & Salary';
  }
  if (lower.includes('debt') || lower.includes('loan') || lower.includes('repay') || lower.includes('credit card')) {
    return 'Debt Repayment';
  }
  return cat.trim();
}

/**
 * Add a single transaction.
 */
export function addTransaction({
  date = null,
  description = '',
  amount = 0,
  type = 'expense', // 'expense' | 'income'
  category = 'Miscellaneous',
  account = 'Primary Account',
  reference = ''
}) {
  const state = loadBudgetState();
  const numAmount = Math.abs(Number(amount) || 0);
  if (numAmount === 0 && !description) {
    throw new Error('Transaction requires a valid description or non-zero amount.');
  }

  const txDate = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  const newTx = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    date: txDate,
    description: String(description || 'Untitled Transaction').trim(),
    amount: numAmount,
    type: type === 'income' ? 'income' : 'expense',
    category: normalizeCategory(category),
    account: String(account || 'Primary Account').trim(),
    reference: String(reference || '').trim(),
    createdAt: Date.now()
  };

  state.transactions.unshift(newTx);
  saveBudgetState(state);
  return newTx;
}

/**
 * Bulk insert verified transactions.
 */
export function addTransactions(txList = []) {
  if (!Array.isArray(txList) || txList.length === 0) return [];
  const state = loadBudgetState();
  const inserted = [];

  for (const item of txList) {
    const numAmount = Math.abs(Number(item.amount) || 0);
    if (!numAmount && !item.description) continue;

    const txDate = item.date ? new Date(item.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const newTx = {
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      date: txDate,
      description: String(item.description || 'Imported Transaction').trim(),
      amount: numAmount,
      type: item.type === 'income' ? 'income' : 'expense',
      category: normalizeCategory(item.category || 'Miscellaneous'),
      account: String(item.account || 'Imported Statement').trim(),
      reference: String(item.reference || '').trim(),
      createdAt: Date.now()
    };
    state.transactions.unshift(newTx);
    inserted.push(newTx);
  }

  saveBudgetState(state);
  return inserted;
}

/**
 * Query transactions with filters.
 */
export function getTransactions({
  category = null,
  type = null,
  startDate = null,
  endDate = null,
  search = null,
  limit = 100
} = {}) {
  const state = loadBudgetState();
  let results = state.transactions;

  if (category) {
    const targetCat = normalizeCategory(category).toLowerCase();
    results = results.filter(tx => (tx.category || '').toLowerCase().includes(targetCat) || targetCat.includes((tx.category || '').toLowerCase()));
  }

  if (type) {
    results = results.filter(tx => tx.type === type);
  }

  if (startDate) {
    results = results.filter(tx => tx.date >= startDate);
  }

  if (endDate) {
    results = results.filter(tx => tx.date <= endDate);
  }

  if (search) {
    const q = search.toLowerCase();
    results = results.filter(tx =>
      (tx.description || '').toLowerCase().includes(q) ||
      (tx.category || '').toLowerCase().includes(q) ||
      (tx.reference || '').toLowerCase().includes(q)
    );
  }

  return results.slice(0, limit);
}

/**
 * Authoritative spending analysis.
 * Answers questions such as "Am I spending too much on food?" honestly from real data.
 */
export function getSpendingAnalysis({ category = null, month = null, year = null } = {}) {
  const state = loadBudgetState();
  const allTx = state.transactions;

  if (!allTx || allTx.length === 0) {
    return {
      hasData: false,
      totalSpent: 0,
      totalIncome: 0,
      netSavings: 0,
      transactionCount: 0,
      categorySpent: 0,
      categoryPercentage: 0,
      categoryTransactionCount: 0,
      breakdown: {},
      message: 'No transactions found in your budget records. To analyze your spending, please add transactions or import a bank statement.'
    };
  }

  let filtered = allTx;
  if (year) {
    filtered = filtered.filter(tx => tx.date.startsWith(`${year}`));
  }
  if (month) {
    const mStr = String(month).padStart(2, '0');
    filtered = filtered.filter(tx => tx.date.includes(`-${mStr}-`));
  }

  const expenses = filtered.filter(tx => tx.type === 'expense');
  const income = filtered.filter(tx => tx.type === 'income');

  const totalSpent = expenses.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const totalIncome = income.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const netSavings = totalIncome - totalSpent;

  const breakdown = {};
  for (const tx of expenses) {
    const cat = tx.category || 'Miscellaneous';
    breakdown[cat] = (breakdown[cat] || 0) + (tx.amount || 0);
  }

  let categorySpent = 0;
  let categoryTransactionCount = 0;
  let targetCategoryName = category;

  if (category) {
    const normalized = normalizeCategory(category);
    targetCategoryName = normalized;
    const catExpenses = expenses.filter(tx => (tx.category || '').toLowerCase() === normalized.toLowerCase());
    categorySpent = catExpenses.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    categoryTransactionCount = catExpenses.length;
  }

  const categoryPercentage = totalSpent > 0 ? ((categorySpent / totalSpent) * 100) : 0;
  const budgetLimit = targetCategoryName ? (state.budgets[targetCategoryName] || null) : null;

  let assessment = '';
  if (category && categoryTransactionCount === 0) {
    assessment = `No recorded expenses found for ${targetCategoryName}.`;
  } else if (category && budgetLimit) {
    if (categorySpent > budgetLimit) {
      assessment = `You have spent ₦${categorySpent.toLocaleString()}, which is ₦${(categorySpent - budgetLimit).toLocaleString()} above your monthly budget of ₦${budgetLimit.toLocaleString()} for ${targetCategoryName}.`;
    } else {
      assessment = `You have spent ₦${categorySpent.toLocaleString()} out of your ₦${budgetLimit.toLocaleString()} budget (${((categorySpent / budgetLimit) * 100).toFixed(1)}%) for ${targetCategoryName}. You are within budget.`;
    }
  } else if (category) {
    if (categoryPercentage > 40) {
      assessment = `${targetCategoryName} represents ${categoryPercentage.toFixed(1)}% of your total expenses (₦${categorySpent.toLocaleString()} out of ₦${totalSpent.toLocaleString()}), which is a significant portion of your total spending.`;
    } else {
      assessment = `${targetCategoryName} represents ${categoryPercentage.toFixed(1)}% of your total expenses (₦${categorySpent.toLocaleString()} out of ₦${totalSpent.toLocaleString()}).`;
    }
  }

  return {
    hasData: true,
    totalSpent,
    totalIncome,
    netSavings,
    transactionCount: filtered.length,
    category: targetCategoryName,
    categorySpent,
    categoryPercentage: Number(categoryPercentage.toFixed(1)),
    categoryTransactionCount,
    budgetLimit,
    breakdown,
    assessment,
    message: assessment || `Total spending is ₦${totalSpent.toLocaleString()} across ${expenses.length} expense transactions.`
  };
}

/**
 * Debts management
 */
export function getDebts() {
  const state = loadBudgetState();
  return state.debts || [];
}

export function addDebt({
  name,
  totalAmount,
  remainingAmount = null,
  interestRate = 0,
  minimumPayment = 0,
  dueDate = null,
  category = 'Loan'
}) {
  const state = loadBudgetState();
  const total = Math.abs(Number(totalAmount) || 0);
  const remaining = remainingAmount !== null ? Math.abs(Number(remainingAmount)) : total;

  if (!name || total <= 0) {
    throw new Error('Debt requires a name and positive total amount.');
  }

  const newDebt = {
    id: `debt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: String(name).trim(),
    totalAmount: total,
    remainingAmount: remaining,
    interestRate: Number(interestRate) || 0,
    minimumPayment: Number(minimumPayment) || 0,
    dueDate: dueDate || null,
    category: String(category || 'Loan').trim(),
    createdAt: Date.now()
  };

  state.debts.push(newDebt);
  saveBudgetState(state);
  return newDebt;
}

export function recordDebtRepayment(debtId, paymentAmount, date = null) {
  const state = loadBudgetState();
  const debt = state.debts.find(d => d.id === debtId || d.name.toLowerCase() === String(debtId).toLowerCase());
  if (!debt) {
    throw new Error(`Debt not found with ID or name "${debtId}".`);
  }

  const amount = Math.abs(Number(paymentAmount) || 0);
  if (amount <= 0) {
    throw new Error('Repayment amount must be greater than zero.');
  }

  debt.remainingAmount = Math.max(0, debt.remainingAmount - amount);

  // Authoritative link: Record repayment as a transaction in BudgetStore
  const repaymentTx = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    date: date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    description: `Repayment: ${debt.name}`,
    amount,
    type: 'expense',
    category: 'Debt Repayment',
    account: 'Debt Servicing',
    reference: debt.id,
    createdAt: Date.now()
  };
  state.transactions.unshift(repaymentTx);

  saveBudgetState(state);
  return {
    debt,
    transaction: repaymentTx,
    remainingAmount: debt.remainingAmount,
    isPaidOff: debt.remainingAmount === 0,
    message: debt.remainingAmount === 0
      ? `Debt "${debt.name}" is completely paid off!`
      : `Paid ₦${amount.toLocaleString()} toward "${debt.name}". Remaining balance: ₦${debt.remainingAmount.toLocaleString()}.`
  };
}

/**
 * Bank Statement Parser
 * Parses CSV, TSV, or plain formatted bank statement text.
 * Deterministically extracts date, description/payee, and amount/type.
 */
export function parseBankStatement(content, { defaultAccount = 'Bank Statement' } = {}) {
  if (!content || typeof content !== 'string') {
    return { success: false, error: 'Empty statement content provided.', transactions: [] };
  }

  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { success: false, error: 'Statement contains no readable lines.', transactions: [] };
  }

  const parsedTransactions = [];
  const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(',') ? ',' : ';');

  // Check if first line is a header
  const headerTokens = lines[0].split(delimiter).map(t => t.trim().toLowerCase().replace(/^["']|["']$/g, ''));
  const hasDateCol = headerTokens.some(t => t.includes('date') || t.includes('time'));
  const hasDescCol = headerTokens.some(t => t.includes('desc') || t.includes('narr') || t.includes('detail') || t.includes('payee') || t.includes('remark'));
  const hasAmountCol = headerTokens.some(t => t.includes('amount') || t.includes('debit') || t.includes('credit') || t.includes('value'));

  const startIndex = (hasDateCol || hasDescCol || hasAmountCol) ? 1 : 0;

  // Header column index map
  let dateIdx = -1;
  let descIdx = -1;
  let amountIdx = -1;
  let debitIdx = -1;
  let creditIdx = -1;

  if (startIndex === 1) {
    headerTokens.forEach((col, idx) => {
      if (col.includes('date')) dateIdx = idx;
      else if (col.includes('desc') || col.includes('narr') || col.includes('detail') || col.includes('payee')) descIdx = idx;
      else if (col.includes('debit')) debitIdx = idx;
      else if (col.includes('credit')) creditIdx = idx;
      else if (col.includes('amount') || col.includes('value')) amountIdx = idx;
    });
  }

  for (let i = startIndex; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;

    // Handle CSV quoting
    let columns = [];
    if (delimiter === ',') {
      const re = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
      let m;
      while ((m = re.exec(rawLine)) !== null) {
        let val = m[1];
        if (val) {
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/""/g, '"');
          columns.push(val.trim());
        }
      }
    } else {
      columns = rawLine.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    }

    if (columns.length < 2) continue;

    let dateStr = '';
    let description = '';
    let amount = 0;
    let type = 'expense';

    if (dateIdx >= 0 && columns[dateIdx]) {
      dateStr = columns[dateIdx];
    }
    if (descIdx >= 0 && columns[descIdx]) {
      description = columns[descIdx];
    }

    if (debitIdx >= 0 && columns[debitIdx] && parseFloat(columns[debitIdx].replace(/[^0-9.-]/g, '')) > 0) {
      amount = parseFloat(columns[debitIdx].replace(/[^0-9.-]/g, ''));
      type = 'expense';
    } else if (creditIdx >= 0 && columns[creditIdx] && parseFloat(columns[creditIdx].replace(/[^0-9.-]/g, '')) > 0) {
      amount = parseFloat(columns[creditIdx].replace(/[^0-9.-]/g, ''));
      type = 'income';
    } else if (amountIdx >= 0 && columns[amountIdx]) {
      const rawVal = columns[amountIdx].replace(/[^0-9.-]/g, '');
      const parsedNum = parseFloat(rawVal);
      if (!isNaN(parsedNum)) {
        amount = Math.abs(parsedNum);
        type = parsedNum < 0 ? 'expense' : (columns[amountIdx].includes('CR') ? 'income' : 'expense');
      }
    } else {
      // Fallback index scanning
      for (const col of columns) {
        const cleanVal = col.replace(/[^0-9.-]/g, '');
        const p = parseFloat(cleanVal);
        if (!isNaN(p) && p > 0 && amount === 0) {
          amount = p;
        } else if (!dateStr && /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4}/.test(col)) {
          dateStr = col;
        } else if (!description && col.length > 2 && isNaN(Number(col))) {
          description = col;
        }
      }
    }

    if (amount > 0 || description) {
      // If description or category indicates income, set type to income
      const lowerDesc = description.toLowerCase();
      if (lowerDesc.includes('salary') || lowerDesc.includes('payroll') || lowerDesc.includes('deposit') || lowerDesc.includes('credit') || lowerDesc.includes('inflow') || lowerDesc.includes('refund')) {
        type = 'income';
      }

      // Clean date
      let formattedDate = new Date().toISOString().split('T')[0];
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toISOString().split('T')[0];
        }
      }

      parsedTransactions.push({
        date: formattedDate,
        description: description || 'Bank Statement Entry',
        amount: Math.abs(amount),
        type,
        category: normalizeCategory(description),
        account: defaultAccount
      });
    }
  }

  if (parsedTransactions.length === 0) {
    return {
      success: false,
      error: 'Could not parse any valid transaction rows from the provided statement text.',
      transactions: []
    };
  }

  return {
    success: true,
    transactions: parsedTransactions,
    count: parsedTransactions.length
  };
}

/**
 * Import bank statement directly into authoritative BudgetStore.
 */
export function importBankStatement(content, options = {}) {
  const parseResult = parseBankStatement(content, options);
  if (!parseResult.success) {
    return parseResult;
  }

  const inserted = addTransactions(parseResult.transactions);
  const totalIncome = inserted.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = inserted.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return {
    success: true,
    count: inserted.length,
    insertedTransactions: inserted,
    totalIncome,
    totalExpense,
    message: `Successfully imported and verified ${inserted.length} transactions from bank statement (Income: ₦${totalIncome.toLocaleString()}, Expenses: ₦${totalExpense.toLocaleString()}).`
  };
}

/**
 * Clear all budget data (for testing or reset).
 */
export function clearBudgetData() {
  saveBudgetState(getInitialState());
}
