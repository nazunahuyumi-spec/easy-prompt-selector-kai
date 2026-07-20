
Easy Prompt Selector - Kai (EPS-Kai)
WebUIのプロンプト入力を劇的に快適にする、Easy Prompt Selectorの改造バージョンです。
タグ編集を快適にする「匠エディタ」も標準搭載しています。


⚠️ 注意事項・動作環境
対応環境: Stable Diffusion WebUI (AUTOMATIC1111) v1.6以降推奨。

競合について: オリジナルの easy-prompt-selector と同時に有効化すると挙動が不安定になる可能性があるため、どちらか片方を有効にしてください。

免責事項: 本スクリプトの使用によるWebUIの不具合や生成環境への影響について、製作者は一切の責任を負いかねます。自己責任での導入をお願いいたします。



📦 導入方法
extensions/ フォルダ内にこのフォルダを丸ごと配置してください。

sdweb-easy-prompt-selector-kai/  (← 拡張機能のメインフォルダ名)
├── javascript/
│   ├── easy-prompt-selector.js  (EPS-Kai本体)
│   └── takumi-editor.js         (匠エディタ本体)
├── tags/
│   ├── default_sample.yml       (用意した軽量のサンプルYAML)
│   └── (その他の基本YAML)
├── eps_kai_manual.html           (HTMLマニュアル)
└── README.txt                 (このファイルです。まずはお読みください)


WebUIを完全に再起動（Restart UI）すると有効化されます。

詳しい使い方は、フォルダ内の eps_kai_manual.html をご覧ください。


🚀 さらに快適な環境へ（有料版のご案内）
Noteにて、プロンプトの強弱を直感的に操作できる**「ラジオ＆スライダー拡張機能」および、すぐに使える「大量の特製プレミアムYAMLデータパック」**を有料販売中です。キャラメイクの限界を突破したい方はぜひご検討ください！

https://note.com/preview/nd12daafc6a5a?prev_access_key=aae0fd11e56b19f8e669b999a0efebc6