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
    
    logs.forEach(log => {
      if (log.actual_cost) totalCost += log.actual_cost;
      if (!log.is_eating_out) homeCookedCount++;
      if (log.actual_calories) {
        totalCal += log.actual_calories;
        calCount++;
      }
    });

    // コスト表示
    this.costValEl.textContent = `¥${totalCost.toLocaleString()}`;
    
    // 自炊率
    const ratio = logs.length > 0 ? Math.round((homeCookedCount / logs.length) * 100) : 0;
    this.cookingRatioValEl.textContent = `${ratio}%`;

    // 平均摂取カロリー
    const avgCal = calCount > 0 ? Math.round(totalCal / calCount) : 0;
    this.caloriesValEl.textContent = avgCal > 0 ? `${avgCal} kcal` : '---';

    // 期限切れ廃棄数 (ダミー/またはローカルストレージから)
    // ここではデモ用に、削除されたもののうち期限切れだった数などを表現するか、0を表示
    this.wasteValEl.textContent = '0 品';

    // PFCバランスの簡易評価
    let pCount = 0, fCount = 0, cCount = 0;
    logs.forEach(log => {
      if (log.actual_pfc) {
        const pfc = log.actual_pfc;
        if (pfc.protein === 'high') pCount += 3;
        else if (pfc.protein === 'medium') pCount += 2;
        else pCount += 1;

        if (pfc.fat === 'low') fCount += 3;
        else if (pfc.fat === 'medium') fCount += 2;
        else fCount += 1;

        if (pfc.carb === 'medium') cCount += 3;
        else if (pfc.carb === 'high') cCount += 2;
        else cCount += 1;
      }
    });

    const totalPfcRating = (pCount + fCount + cCount) || 1;
    this.pfcProteinValEl.textContent = logs.length > 0 ? (pCount >= 2.2 * logs.length ? '高タンパク' : '適正') : '---';
    this.pfcFatValEl.textContent = logs.length > 0 ? (fCount >= 2.2 * logs.length ? '低脂質' : 'やや過剰') : '---';
    this.pfcCarbValEl.textContent = logs.length > 0 ? (cCount >= 2.2 * logs.length ? '適正' : 'やや高め') : '---';
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
