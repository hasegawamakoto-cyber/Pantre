/* -------------------------------------------------------------
 * PanTré (パントレ) - speech.js
 * Web Speech API による音声入力モジュール
 * ------------------------------------------------------------- */

class SpeechService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.onResult = null;       // 認識完了コールバック (text) => {}
    this.onInterim = null;      // 中間結果コールバック (text) => {}
    this.onStart = null;        // 認識開始コールバック () => {}
    this.onEnd = null;          // 認識終了コールバック () => {}
    this.onError = null;        // エラーコールバック (error) => {}

    this.init();
  }

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('PanTré: このブラウザは音声認識に対応していません');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'ja-JP';
    this.recognition.continuous = false;      // 一度の発話で停止
    this.recognition.interimResults = true;   // 中間結果も受け取る
    this.recognition.maxAlternatives = 1;

    // イベントリスナー
    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // 中間結果のコールバック
      if (interimTranscript && this.onInterim) {
        this.onInterim(interimTranscript);
      }

      // 最終結果のコールバック
      if (finalTranscript && this.onResult) {
        this.onResult(finalTranscript);
      }
    };

    this.recognition.onstart = () => {
      this.isListening = true;
      if (this.onStart) this.onStart();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onEnd) this.onEnd();
    };

    this.recognition.onerror = (event) => {
      console.error('音声認識エラー:', event.error);
      this.isListening = false;

      let errorMessage = '';
      switch (event.error) {
        case 'no-speech':
          errorMessage = '音声が検出されませんでした。もう一度お試しください。';
          break;
        case 'aborted':
          errorMessage = '音声認識が中断されました。';
          break;
        case 'audio-capture':
          errorMessage = 'マイクが見つかりません。マイクの接続を確認してください。';
          break;
        case 'not-allowed':
          errorMessage = 'マイクの使用が許可されていません。ブラウザの設定を確認してください。';
          break;
        case 'network':
          errorMessage = 'ネットワークエラーが発生しました。';
          break;
        default:
          errorMessage = `音声認識エラー: ${event.error}`;
      }

      if (this.onError) this.onError(errorMessage);
    };
  }

  // 音声認識が利用可能か
  isAvailable() {
    return !!this.recognition;
  }

  // 音声認識を開始
  start() {
    if (!this.recognition) {
      if (this.onError) {
        this.onError('このブラウザは音声認識に対応していません。Chrome または Edge をお使いください。');
      }
      return;
    }

    if (this.isListening) {
      this.stop();
      return;
    }

    try {
      this.recognition.start();
    } catch (err) {
      console.error('音声認識開始エラー:', err);
      if (this.onError) {
        this.onError('音声認識の開始に失敗しました。');
      }
    }
  }

  // 音声認識を停止
  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  // トグル（開始/停止）
  toggle() {
    if (this.isListening) {
      this.stop();
    } else {
      this.start();
    }
  }
}

const speech = new SpeechService();
