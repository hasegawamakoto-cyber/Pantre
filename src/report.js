/* -------------------------------------------------------------
 * PanTré (パントレ) - report.js
 * サマリーレポートページ コントローラー (Chart.js描画、AIレポート連携)
 * ------------------------------------------------------------- */

class ReportController {
  constructor() {
    this.caloriesChart = null;
    this.pfcChart = null;
    this.costChart = null;
    
    // DOM要素キャッシュ
    this.costValEl = null;
    this.cookingRatioValEl = null;
    this.caloriesValEl = null;
    this.wasteValEl = null;
    
    this.pfcProteinValEl = null;
    this.pfcFatValEl = null;
    this.pfcCarbValEl = null;
    
    this.aiReportContentEl = null;
    this.btnGenerateReportEl = null;
    this.mealHistoryListEl = null;

    // 昼夜平均用のDOM要素
    this.statCostLunchEl = null;
    this.statCostDinnerEl = null;
    this.statCalLunchEl = null;
    this.statCalDinnerEl = null;
    this.pfcProLunchEl = null;
    this.pfcProDinnerEl = null;
    this.pfcFatLunchEl = null;
    this.pfcFatDinnerEl = null;
    this.pfcCarbLunchEl = null;
    this.pfcCarbDinnerEl = null;
  }

  init() {
    this.costValEl = document.getElementById('report-stat-cost');
    this.cookingRatioValEl = document.getElementById('report-stat-ratio');
    this.caloriesValEl = document.getElementById('report-stat-calories');
    this.wasteValEl = document.getElementById('report-stat-waste');
    
    this.pfcProteinValEl = document.getElementById('report-pfc-protein');
    this.pfcFatValEl = document.getElementById('report-pfc-fat');
    this.pfcCarbValEl = document.getElementById('report-pfc-carb');
    
    this.aiReportContentEl = document.getElementById('report-ai-content');
    this.btnGenerateReportEl = document.getElementById('btn-generate-report');
    this.mealHistoryListEl = document.getElementById('report-meal-history');

    this.statCostLunchEl = document.getElementById('stat-cost-lunch');
    this.statCostDinnerEl = document.getElementById('stat-cost-dinner');
    this.statCalLunchEl = document.getElementById('stat-cal-lunch');
    this.statCalDinnerEl = document.getElementById('stat-cal-dinner');
    this.pfcProLunchEl = document.getElementById('pfc-pro-lunch');
    this.pfcProDinnerEl = document.getElementById('pfc-pro-dinner');
    this.pfcFatLunchEl = document.getElementById('pfc-fat-lunch');
    this.pfcFatDinnerEl = document.getElementById('pfc-fat-dinner');
    this.pfcCarbLunchEl = document.getElementById('pfc-carb-lunch');
    this.pfcCarbDinnerEl = document.getElementById('pfc-carb-dinner');

    if (!this.btnGenerateReportEl) return;

    this.setupEventListeners();
    this.render();
  }

  setupEventListeners() {
    this.btnGenerateReportEl.addEventListener('click', () => this.generateAIReport());
  }

  async render() {
    // データ取得
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const mealLogs = await db.getMealLogs(startOfMonth, endOfMonth);
    const mealPlans = await db.getMealPlans(startOfMonth, endOfMonth);
    const foodItems = currentFoodItems;

    // 1. 統計の計算
    this.calculateStats(mealLogs);
    
    // 2. チャート描画
    this.renderCharts(mealLogs);

    // 3. 食事履歴リストの描画
    this.renderMealHistory(mealLogs);

    // AIレポート表示のリセット (以前のデータがあれば表示)
    const savedReport = localStorage.getItem(`pantre_ai_report_${today.getFullYear()}_${today.getMonth()}`);
    if (savedReport) {
      this.aiReportContentEl.innerHTML = this.renderMarkdown(savedReport);
      this.btnGenerateReportEl.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 分析レポートを再生成';
    } else {
      this.aiReportContentEl.innerHTML = '<p class="empty-message">分析ボタンをタップすると、今月の食事記録から健康と食費のアドバイスレポートをAIが生成します。</p>';
    }
  }

  calculateStats(logs) {
    const today = new Date();
    let totalCost = 0;
    let homeCookedCount = 0;
    let totalCal = 0;
    let calCount = 0;

    // 昼と夜の集計用
    let lunchCost = 0, lunchCostCount = 0;
    let dinnerCost = 0, dinnerCostCount = 0;
    let lunchCal = 0, lunchCalCount = 0;
    let dinnerCal = 0, dinnerCalCount = 0;

    let pfcCounts = {
      total: { p: 0, f: 0, c: 0, count: 0 },
      lunch: { p: 0, f: 0, c: 0, count: 0 },
      dinner: { p: 0, f: 0, c: 0, count: 0 }
    };
    
    logs.forEach(log => {
      if (log.actual_cost) {
        totalCost += log.actual_cost;
        if (log.meal_type === 'lunch') { lunchCost += log.actual_cost; lunchCostCount++; }
        if (log.meal_type === 'dinner') { dinnerCost += log.actual_cost; dinnerCostCount++; }
      }
      if (!log.is_eating_out) homeCookedCount++;
      if (log.actual_calories) {
        totalCal += log.actual_calories;
        calCount++;
        if (log.meal_type === 'lunch') { lunchCal += log.actual_calories; lunchCalCount++; }
        if (log.meal_type === 'dinner') { dinnerCal += log.actual_calories; dinnerCalCount++; }
      }

      if (log.actual_pfc) {
        const pfc = log.actual_pfc;
        const addPfc = (target) => {
          if (pfc.protein === 'high') target.p += 3; else if (pfc.protein === 'medium') target.p += 2; else target.p += 1;
          if (pfc.fat === 'low') target.f += 3; else if (pfc.fat === 'medium') target.f += 2; else target.f += 1;
          if (pfc.carb === 'medium') target.c += 3; else if (pfc.carb === 'high') target.c += 2; else target.c += 1;
          target.count++;
        };
        addPfc(pfcCounts.total);
        if (log.meal_type === 'lunch') addPfc(pfcCounts.lunch);
        if (log.meal_type === 'dinner') addPfc(pfcCounts.dinner);
      }
    });

    // コスト表示
    this.costValEl.textContent = `¥${totalCost.toLocaleString()}`;
    if (this.statCostLunchEl) this.statCostLunchEl.textContent = lunchCostCount ? `¥${Math.round(lunchCost/lunchCostCount).toLocaleString()}` : '-';
    if (this.statCostDinnerEl) this.statCostDinnerEl.textContent = dinnerCostCount ? `¥${Math.round(dinnerCost/dinnerCostCount).toLocaleString()}` : '-';
    
    // 自炊率
    const ratio = logs.length > 0 ? Math.round((homeCookedCount / logs.length) * 100) : 0;
    this.cookingRatioValEl.textContent = `${ratio}%`;

    // 平均摂取カロリー
    const avgCal = calCount > 0 ? Math.round(totalCal / calCount) : 0;
    this.caloriesValEl.textContent = avgCal > 0 ? `${avgCal} kcal` : '---';
    if (this.statCalLunchEl) this.statCalLunchEl.textContent = lunchCalCount ? Math.round(lunchCal/lunchCalCount) : '-';
    if (this.statCalDinnerEl) this.statCalDinnerEl.textContent = dinnerCalCount ? Math.round(dinnerCal/dinnerCalCount) : '-';

    this.wasteValEl.textContent = '0 品';

    // PFCバランス評価関数
    const evalPfc = (counts) => {
      if (counts.count === 0) return { p: '-', f: '-', c: '-' };
      return {
        p: counts.p >= 2.2 * counts.count ? '高タンパク' : '適正',
        f: counts.f >= 2.2 * counts.count ? '低脂質' : 'やや過剰',
        c: counts.c >= 2.2 * counts.count ? '適正' : 'やや高め'
      };
    };

    const totalEval = evalPfc(pfcCounts.total);
    const lunchEval = evalPfc(pfcCounts.lunch);
    const dinnerEval = evalPfc(pfcCounts.dinner);

    this.pfcProteinValEl.textContent = totalEval.p;
    this.pfcFatValEl.textContent = totalEval.f;
    this.pfcCarbValEl.textContent = totalEval.c;

    if (this.pfcProLunchEl) this.pfcProLunchEl.textContent = lunchEval.p;
    if (this.pfcProDinnerEl) this.pfcProDinnerEl.textContent = dinnerEval.p;
    if (this.pfcFatLunchEl) this.pfcFatLunchEl.textContent = lunchEval.f;
    if (this.pfcFatDinnerEl) this.pfcFatDinnerEl.textContent = dinnerEval.f;
    if (this.pfcCarbLunchEl) this.pfcCarbLunchEl.textContent = lunchEval.c;
    if (this.pfcCarbDinnerEl) this.pfcCarbDinnerEl.textContent = dinnerEval.c;
  }

  renderCharts(logs) {
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js が読み込まれていません');
      return;
    }

    const ctxCal = document.getElementById('chart-calories')?.getContext('2d');
    const ctxCost = document.getElementById('chart-cost')?.getContext('2d');

    if (!ctxCal || !ctxCost) return;

    // 前回のチャートインスタンスを破棄
    if (this.caloriesChart) this.caloriesChart.destroy();
    if (this.costChart) this.costChart.destroy();

    // 日付別データの集計
    const dates = [];
    const caloriesData = [];
    const costHomeData = [];
    const costOutData = [];

    // 今月の全日付を用意
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      dates.push(day + '日');
      
      const log = logs.find(l => l.logged_date === dateStr);
      caloriesData.push(log?.actual_calories || 0);
      
      if (log) {
        if (log.is_eating_out) {
          costOutData.push(log.actual_cost || 0);
          costHomeData.push(0);
        } else {
          costHomeData.push(log.actual_cost || 0);
          costOutData.push(0);
        }
      } else {
        costHomeData.push(0);
        costOutData.push(0);
      }
    }

    // 1. カロリー推移グラフ
    this.caloriesChart = new Chart(ctxCal, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{
          label: '摂取カロリー (kcal)',
          data: caloriesData,
          borderColor: '#6DB56D',
          backgroundColor: 'rgba(109, 181, 109, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#8B8D94' }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#8B8D94', maxTicksLimit: 10 }
          }
        }
      }
    });

    // 2. コスト推移グラフ (積み上げ棒グラフ)
    this.costChart = new Chart(ctxCost, {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [
          {
            label: '自炊 (円)',
            data: costHomeData,
            backgroundColor: '#6DB56D'
          },
          {
            label: '外食 (円)',
            data: costOutData,
            backgroundColor: '#E8935A'
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: { color: '#8B8D94', boxWidth: 12 },
            position: 'bottom'
          }
        },
        scales: {
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#8B8D94' }
          },
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: '#8B8D94', maxTicksLimit: 10 }
          }
        }
      }
    });
  }

  renderMealHistory(logs) {
    this.mealHistoryListEl.innerHTML = '';
    
    if (logs.length === 0) {
      this.mealHistoryListEl.innerHTML = '<div class="day-detail-empty">食事記録がありません</div>';
      return;
    }

    // 日付の降順に並べ替え
    const sortedLogs = [...logs].sort((a, b) => b.logged_date.localeCompare(a.logged_date));

    sortedLogs.slice(0, 10).forEach(log => {
      const item = document.createElement('div');
      item.className = 'report-meal-item';
      
      const dateParts = log.logged_date.split('-');
      const formattedDate = `${dateParts[1]}/${dateParts[2]}`;

      item.innerHTML = `
        <span class="report-meal-date">${formattedDate}</span>
        <span class="report-meal-title">${log.title}</span>
        <span class="report-meal-badge ${log.is_eating_out ? 'out' : 'home'}">${log.is_eating_out ? '外食' : '自炊'}</span>
        <span class="report-meal-cal">${log.actual_calories ? log.actual_calories + ' kcal' : ''}</span>
      `;
      this.mealHistoryListEl.appendChild(item);
    });
  }

  // --- AIレポート生成 ---
  async generateAIReport() {
    if (!gemini.isConfigured()) {
      showToast('Gemini APIキーを設定してください', 'warning');
      navigateTo('settings');
      return;
    }

    this.btnGenerateReportEl.classList.add('loading');
    this.btnGenerateReportEl.innerHTML = '<i class="fa-solid fa-spinner"></i> 分析レポート生成中...';
    this.aiReportContentEl.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div><p style="text-align:center;font-size:0.8rem;color:var(--text-secondary);">今月の食材消費データと食事記録をAIが詳細に分析しています...</p>';

    try {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

      const mealLogs = await db.getMealLogs(startOfMonth, endOfMonth);
      const mealPlans = await db.getMealPlans(startOfMonth, endOfMonth);
      const foodItems = currentFoodItems;

      const context = {
        foodItems,
        mealLogs,
        mealPlans
      };

      const reportText = await gemini.generateMonthlyReport(context);
      
      // 結果を保存
      localStorage.setItem(`pantre_ai_report_${today.getFullYear()}_${today.getMonth()}`, reportText);

      // 表示
      this.aiReportContentEl.innerHTML = this.renderMarkdown(reportText);
      showToast('月間AIレポートを生成しました！ 🧙', 'success');

    } catch (err) {
      console.error(err);
      this.aiReportContentEl.innerHTML = `<p style="color:var(--color-danger)">レポート生成に失敗しました。<br>${err.message}</p>`;
      showToast('レポート生成エラー', 'error');
    } finally {
      this.btnGenerateReportEl.classList.remove('loading');
      this.btnGenerateReportEl.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 分析レポートを再生成';
    }
  }

  // --- 簡易マークダウンレンダリング (chat.jsと同様) ---
  renderMarkdown(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^(\*\*\*|---)$/gm, '<hr>');
    html = html.replace(/^[・\-]\s*(.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    if (!html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<hr')) {
      html = `<p>${html}</p>`;
    }
    return html;
  }
}

const reportController = new ReportController();
