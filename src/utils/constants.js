/* -------------------------------------------------------------
 * PanTré (パントレ) - constants.js
 * アプリケーションの定数定義 (カテゴリ、単位、絵文字、デモデータ)
 * ------------------------------------------------------------- */

const DEFAULT_CATEGORIES = [
  { id: 'cat-refrigerator', name: '冷蔵庫', icon: '🧊', sort_order: 1 },
  { id: 'cat-freezer', name: '冷凍庫', icon: '❄️', sort_order: 2 },
  { id: 'cat-seasoning', name: '調味料', icon: '🧂', sort_order: 3 },
  { id: 'cat-dry-canned', name: '乾物・缶詰', icon: '🫘', sort_order: 4 },
  { id: 'cat-room-temp', name: '常温ストック', icon: '📦', sort_order: 5 },
  { id: 'cat-beverage', name: '飲料', icon: '🥤', sort_order: 6 }
];

const DEFAULT_UNITS = [
  '個',
  'パック',
  '本',
  '袋',
  'g',
  'ml',
  '缶',
  '瓶',
  '束',
  '丁',
  '枚',
  '株',
  'カスタム'
];

// 食材名に含まれるキーワードから絵文字を推測するマッピング
const EMOJI_KEYWORDS = [
  { keywords: ['肉', '豚', '牛', '鶏', 'ステーキ', 'ソーセージ', 'ハム', 'ベーコン'], emoji: '🥩' },
  { keywords: ['魚', '鮭', 'サバ', '鯛', 'アジ', 'マグロ', '刺身'], emoji: '🐟' },
  { keywords: ['エビ', '海老', 'シュリンプ'], emoji: '🍤' },
  { keywords: ['貝', 'アサリ', 'ホタテ', 'カキ'], emoji: '🐚' },
  { keywords: ['卵', 'たまご', 'タマゴ'], emoji: '🥚' },
  { keywords: ['乳', '牛乳', 'ミルク', 'ヨーグルト', 'バター', 'チーズ', '生クリーム'], emoji: '🥛' },
  { keywords: ['豆腐', 'トウフ', '納豆', '厚揚げ'], emoji: '🥢' },
  { keywords: ['米', 'ごはん', 'お米'], emoji: '🌾' },
  { keywords: ['パン', 'ブレッド', '食パン', 'ロールパン'], emoji: '🍞' },
  { keywords: ['麺', 'パスタ', 'うどん', 'そば', 'ラーメン', 'スパゲッティ'], emoji: '🍝' },
  { keywords: ['キャベツ', 'レタス', '白菜', 'ほうれん草', '小松菜', 'パセリ', 'ネギ', 'サラダ'], emoji: '🥬' },
  { keywords: ['トマト', 'ミニトマト'], emoji: '🍅' },
  { keywords: ['人参', 'にんじん', 'キャロット'], emoji: '🥕' },
  { keywords: ['玉ねぎ', '玉葱', 'タマネギ'], emoji: '🧅' },
  { keywords: ['じゃがいも', 'ポテト', 'さつまいも', 'かぼちゃ'], emoji: '🥔' },
  { keywords: ['なす', 'ナス', '茄子'], emoji: '🍆' },
  { keywords: ['アボカド'], emoji: '🥑' },
  { keywords: ['きのこ', 'マッシュルーム', 'しいたけ', 'しめじ', 'えのき'], emoji: '🍄' },
  { keywords: ['にんにく', 'ガーリック'], emoji: '🧄' },
  { keywords: ['しょうが', 'ジンジャー'], emoji: '🫚' },
  { keywords: ['リンゴ', 'アップル', '林檎'], emoji: '🍎' },
  { keywords: ['バナナ'], emoji: '🍌' },
  { keywords: ['ミカン', 'みかん', 'オレンジ', 'レモン'], emoji: '🍊' },
  { keywords: ['イチゴ', 'ストロベリー'], emoji: '🍓' },
  { keywords: ['醤油', 'しょうゆ', 'ソース', 'マヨネーズ', 'ケチャップ', 'ポン酢', 'みりん', '酒', '油'], emoji: '🧂' },
  { keywords: ['カレー', 'ルウ', 'シチュー'], emoji: '🍛' },
  { keywords: ['ビール', '発泡酒'], emoji: '🍺' },
  { keywords: ['ワイン'], emoji: '🍷' },
  { keywords: ['コーヒー', '珈琲'], emoji: '☕' },
  { keywords: ['水', '炭酸水', 'ジュース', 'お茶', '麦茶', '緑茶'], emoji: '🥤' },
  { keywords: ['缶', 'サバ缶', 'ツナ缶', 'トマト缶'], emoji: '🥫' }
];

function getFoodEmoji(name) {
  if (!name) return '🛒';
  const lowerName = name.toLowerCase();
  
  // マッピングから部分一致するキーワードを探索
  for (const item of EMOJI_KEYWORDS) {
    if (item.keywords.some(keyword => lowerName.includes(keyword))) {
      return item.emoji;
    }
  }
  
  return '🛒'; // デフォルトの買い物カート
}

// アプリ初回起動時に表示する美しいデモデータ
function getMockFoodItems() {
  const today = new Date();
  
  // 日付の加算・減算ヘルパー
  const addDays = (days) => {
    const d = new Date(today);
    d.setDate(today.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  return [
    {
      id: 'demo-1',
      name: '国産鶏もも肉',
      category_id: 'cat-refrigerator',
      quantity: 2,
      unit: 'パック',
      expiration_date: addDays(2), // 2日後 (警告)
      memo: '唐揚げ用、冷凍しても可',
      sort_order: 1,
      created_at: new Date().toISOString()
    },
    {
      id: 'demo-2',
      name: '明治おいしい牛乳',
      category_id: 'cat-refrigerator',
      quantity: 1,
      unit: '本',
      expiration_date: addDays(-1), // 1日前 (期限切れ)
      memo: '半分開封済み',
      sort_order: 2,
      created_at: new Date().toISOString()
    },
    {
      id: 'demo-3',
      name: 'こだわり極み卵',
      category_id: 'cat-refrigerator',
      quantity: 8,
      unit: '個',
      expiration_date: addDays(5), // 5日後 (注意)
      memo: '生食は早めに',
      sort_order: 3,
      created_at: new Date().toISOString()
    },
    {
      id: 'demo-4',
      name: '冷凍讃岐うどん',
      category_id: 'cat-freezer',
      quantity: 5,
      unit: '食',
      expiration_date: addDays(45), // 安全
      memo: '個包装',
      sort_order: 1,
      created_at: new Date().toISOString()
    },
    {
      id: 'demo-5',
      name: 'キッコーマン特選丸大豆しょうゆ',
      category_id: 'cat-seasoning',
      quantity: 1,
      unit: '本',
      expiration_date: addDays(120), // 安全
      memo: '常温保存中',
      sort_order: 1,
      created_at: new Date().toISOString()
    },
    {
      id: 'demo-6',
      name: 'はごろもシーチキンL',
      category_id: 'cat-dry-canned',
      quantity: 3,
      unit: '缶',
      expiration_date: addDays(300), // 安全
      memo: 'ストック用',
      sort_order: 1,
      created_at: new Date().toISOString()
    },
    {
      id: 'demo-7',
      name: '魚沼産コシヒカリ 5kg',
      category_id: 'cat-room-temp',
      quantity: 1,
      unit: '袋',
      expiration_date: '', // 期限なし
      memo: '開封済み',
      sort_order: 1,
      created_at: new Date().toISOString()
    },
    {
      id: 'demo-8',
      name: 'アサヒスーパードライ 350ml',
      category_id: 'cat-beverage',
      quantity: 6,
      unit: '缶',
      expiration_date: addDays(180),
      memo: '冷えてるの3本',
      sort_order: 1,
      created_at: new Date().toISOString()
    }
  ];
}
