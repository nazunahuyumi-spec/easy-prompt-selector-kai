const GG_CONFIG = {
    colors: {
        takumiOrange: '#fb923c',
        darkBg: '#0f172a',
        cardBg: '#1e293b',
        border: '#334155',
        accent: '#38bdf8',
        danger: '#ef4444',
        success: '#10b981',
        editing: '#f43f5e', 
        sectionBg: 'rgba(30, 41, 59, 0.5)',
        inputFocusBg: '#cbd5e1',
        inputFocusText: '#0f172a' 
    },
    version: '3.3.9',
    thumbnailSize: 320
};

const GG_FLAGS = {
    'C': { label: 'C', color: '#3b82f6', desc: 'Character (素体)' },
    'S': { label: 'S', color: '#10b981', desc: 'Set (衣装込み)' },
    'O': { label: 'O', color: '#f59e0b', desc: 'Outfit (服のみ)' },
    'E': { label: 'E', color: '#8b5cf6', desc: 'Extra (その他)' }
};

class GenesisGearUI {
    constructor() {
        this.yamlData = {};      
        this.filePaths = {};     
        this.currentFileId = 'A00';
        this.favChar = 'A';
        this.favNum = '';
        this.editingItem = null; 
        this.collapsedSections = new Set();
        this.isInitialLoad = true;
        this.pendingImageData = null;
        this.currentThumbnail = null;
        this.thumbnailExists = false;
        this.errorMessage = "";
        this.isResizing = false;
        this.viewerRatio = 0.39; 
        
        this.init();
    }

    async init() {
        console.log("%c [GG] GENESIS GEAR v3.3.9 (匠) 起動開始 ", `background: ${GG_CONFIG.colors.takumiOrange}; color: white; font-weight: bold; padding: 2px 10px; border-radius: 4px;`);
        this.injectStyles();
        this.createMainModal();
        this.initResizerLogic();
        this.startPlacementMonitor();
        await this.loadAllYAMLs();
        
        if (this.favChar && this.favNum) {
            await this.loadFavorites(`favorite${this.favChar}${this.favNum}`); 
        } else {
            this.selectedFile = null;
            this.render();
        }
    }

    // --- YAML Engine: データ同期とシリアライズ ---
    // --- YAML Engine: データ同期とシリアライズ ---
    async loadAllYAMLs() {
        // 🌟 追加：読み込む前に、Python側に最新のフォルダ状況を再スキャンさせる（ブラウザリロード時の先祖返り対策）
        const rescanBtn = document.getElementById('gg_rescan_trigger_btn');
        if (rescanBtn) {
            rescanBtn.click();
            await new Promise(r => setTimeout(r, 600)); // スキャン完了とデータ反映を少し待つ
        }

        let rawData = "";
        const hubId = 'gg_yaml_hub_v2';
        const fetchRawData = () => {
            const hub = document.getElementById(hubId);
            return hub?.querySelector('textarea')?.value || "";
        };

        // 初期化待ちリトライ
        rawData = fetchRawData();
        if (!rawData) {
            for (let i = 1; i <= 15; i++) {
                await new Promise(r => setTimeout(r, 600));
                rawData = fetchRawData();
                if (rawData) break;
            }
        }
        
        if (!rawData) {
            console.warn("[GG] YAMLハブが見つからないか、データが空です。");
            return;
        }

        const paths = rawData.split(',').filter(p => p.trim());
        const newYamlData = {};
        
        for (const path of paths) {
            try {
                const fileName = path.split('/').pop().replace(/\.ya?ml$/, '');
                this.filePaths[fileName] = path;
                const response = await fetch(`file=${path}?t=${Date.now()}`);
                const text = await response.text();

                if (typeof jsyaml !== 'undefined') {
                    const doc = jsyaml.load(text);
                    if (doc) newYamlData[fileName] = doc;
                }
            } catch (e) { 
                console.error(`[GG] ロード失敗: ${path}`, e); 
            }
        }
        
        this.yamlData = newYamlData;
        this.render();
    }

    async loadFavorites(fileName) {
        // 1. 組み立てるのをやめて、リストから正しいフルパスを取得する
        const fullPath = this.filePaths[fileName];

        try {
            // 2. 取得したフルパスをそのまま使う
            const response = await fetch(`file=${fullPath}?t=${Date.now()}`);

            if (!response.ok) {
                console.warn(`[GG] 読み込み失敗: ${fullPath}`);
                this.yamlData[fileName] = {};
            } else {
                const text = await response.text();
                this.yamlData[fileName] = jsyaml.load(text) || {};
            }

            this.selectedFile = fileName;
            this.render();
            
        } catch (e) {
            console.error(`[GG] ロードエラー:`, e);
        }
    }

    stringifyYaml(data) {
        if (typeof jsyaml === 'undefined') return "";

        // データのクローンを作成
        let newData = JSON.parse(JSON.stringify(data));

        // YAMLを生成
        let yamlStr = jsyaml.dump(newData, {
            indent: 2,
            noRefs: true,
            lineWidth: -1,
            noCompatMode: true,
            forceQuotes: true,
            quotingType: '"', // ダブルクォートを強制
            styles: {
                '!!null': 'canonical'
            }
        });

        return yamlStr.replace(/\n\n/g, '\n \n');
    }

    async saveToFile() {
        if (!this.selectedFile) return;

        const fullPath = this.filePaths[this.selectedFile];
        if (!fullPath) {
            console.error("[GG] 保存先フルパスが見つかりません:", this.selectedFile);
            return;
        }

        const targetData = this.yamlData[this.selectedFile];
        const content = this.stringifyYaml(targetData);
        
        const encodedContent = btoa(encodeURIComponent(content));

        try {
            const pathInput = document.getElementById('gg_save_path_in')?.querySelector('textarea');
            const contentInput = document.getElementById('gg_save_content_in')?.querySelector('textarea');
            const saveBtn = document.getElementById('gg_save_trigger_btn');

            if (pathInput && contentInput && saveBtn) {
                pathInput.value = fullPath;  // 修正したフルパスをセット
                contentInput.value = encodedContent; 
                pathInput.dispatchEvent(new Event('input', { bubbles: true }));
                contentInput.dispatchEvent(new Event('input', { bubbles: true }));
                
                // 少し待ってから保存ボタンを押す
                setTimeout(() => { saveBtn.click(); }, 250);
            } else {
                console.warn("[GG] 保存用ハブ(UI要素)が見つかりません。");
            }
        } catch (e) { 
            console.error("[GG] Base64送信エラー", e); 
        }
    }

    initResizerLogic() {
        const resizer = document.getElementById('gg-resizer');
        const container = document.getElementById('gg-main-container');
        
        const onMouseDown = (e) => {
            e.preventDefault();
            this.isResizing = true;
            document.body.style.cursor = 'row-resize';
            resizer.style.background = GG_CONFIG.colors.takumiOrange;
        };

        const onMouseMove = (e) => {
            if (!this.isResizing) return;
            const rect = container.getBoundingClientRect();
            let ratio = (e.clientY - rect.top) / rect.height;
            this.viewerRatio = Math.max(0.1, Math.min(0.9, ratio));
            this.applyLayout();
        };

        const onMouseUp = () => {
            this.isResizing = false;
            document.body.style.cursor = 'default';
            resizer.style.background = GG_CONFIG.colors.border;
        };

        resizer.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    applyLayout() {
        const viewer = document.getElementById('gg-viewer');
        const editor = document.getElementById('gg-editor');
        if (viewer && editor) {
            const vPercent = this.viewerRatio * 100;
            const ePercent = (1 - this.viewerRatio) * 100;
            viewer.style.height = `${vPercent}%`;
            viewer.style.flex = `0 0 ${vPercent}%`;
            editor.style.height = `${ePercent}%`;
            editor.style.flex = `0 0 ${ePercent}%`;
        }
    }

    startPlacementMonitor() {
        setInterval(() => {
            if (!document.getElementById('gg-addon-launcher')) {
                this.injectLauncher();
            }
        }, 3000);
        this.injectLauncher();
    }

    injectLauncher(retryCount = 0) {
        const allButtons = Array.from(document.querySelectorAll('button'));
        const openBtn = allButtons.find(b => b.textContent.includes('❇️展開'));
        const reloadBtn = allButtons.find(b => b.textContent.includes('更新'));

        if ((!openBtn || !reloadBtn) && retryCount < 20) {
            setTimeout(() => this.injectLauncher(retryCount + 1), 500);
            return;
        }

        if (document.getElementById('gg-addon-launcher')) return;

        const btn = document.createElement('button');
        btn.id = 'gg-addon-launcher';
        btn.className = 'lg secondary gradio-button svelte-cmf5ev';

        const orange = (typeof GG_CONFIG !== 'undefined' && GG_CONFIG.colors) ? GG_CONFIG.colors.takumiOrange : '#ff6000';
        
        btn.innerHTML = `
            <span style="color:#333; font-weight:900; letter-spacing:0.02em; vertical-align:middle;">🖍️編集</span>
        `;

        Object.assign(btn.style, {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '2px 4px',
            padding: '5px 5px',
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            height: 'auto',
            minHeight: '32px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            transition: 'all 0.2s'
        });

        btn.onmouseenter = () => { btn.style.backgroundColor = '#f9fafb'; btn.style.borderColor = orange; };
        btn.onmouseleave = () => { btn.style.backgroundColor = '#ffffff'; btn.style.borderColor = '#e5e7eb'; };

        btn.onclick = (e) => {
            e.preventDefault();
            this.open();
        };

        if (reloadBtn && reloadBtn.parentNode) {
            reloadBtn.parentNode.insertBefore(btn, reloadBtn);
        } else {
            const backupTarget = document.getElementById('eps-v2-launcher') || document.getElementById('txt2img_style_apply');
            if (backupTarget && backupTarget.parentNode) {
                backupTarget.parentNode.insertBefore(btn, backupTarget.nextSibling);
            }
        }
    }

    injectStyles() {
        if (document.getElementById('gg-core-styles')) return;
        const style = document.createElement('style');
        style.id = 'gg-core-styles';
        style.textContent = `
            .gg-modal-overlay { 
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
                background: rgba(2, 6, 17, 0.9); backdrop-filter: blur(16px); 
                z-index: 9999; display: none; align-items: center; justify-content: center; 
            }
            .gg-container { 
                width: 98%; height: 96%; background: ${GG_CONFIG.colors.darkBg}; 
                border: 1px solid ${GG_CONFIG.colors.border}; border-radius: 20px; 
                display: flex; flex-direction: column; overflow: hidden; color: white;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            }
            .gg-header { 
                padding: 16px 28px; background: ${GG_CONFIG.colors.cardBg}; 
                border-bottom: 1px solid ${GG_CONFIG.colors.border}; 
                display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; 
            }
            .gg-content { flex: 1; display: flex; overflow: hidden; }
            .gg-sidebar { 
                width: 280px; background: ${GG_CONFIG.colors.cardBg}; 
                border-right: 1px solid ${GG_CONFIG.colors.border}; 
                overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; 
            }
            .gg-side-item { 
                padding: 12px 16px; cursor: pointer; color: #94a3b8; border-radius: 10px; 
                font-size: 0.9rem; border: 1px solid transparent; transition: all 0.2s; 
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            .gg-side-item:hover { background: rgba(255,255,255,0.05); color: white; transform: translateX(4px); }
            .gg-side-item.active { 
                background: rgba(251, 146, 60, 0.15); color: white; 
                border: 1px solid ${GG_CONFIG.colors.takumiOrange}; font-weight: bold;
            }
            .gg-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #070b14; }
            .gg-viewer-area { 
                width: 100%; overflow-y: auto; padding: 24px; background: #0f172a; 
                border-bottom: 1px solid rgba(255,255,255,0.05); box-sizing: border-box; 
            }
            .gg-editor-area { 
                width: 100%; overflow-y: auto; padding: 12px; background: #070b14; 
                display: flex; flex-direction: column; gap: 24px; box-sizing: border-box; position: relative; 
                flex: 0 0 450px;
            }
            .gg-resizer { 
                height: 12px; background: ${GG_CONFIG.colors.border}; cursor: row-resize; 
                display: flex; align-items: center; justify-content: center; z-index: 100; transition: 0.2s; 
            }
            .gg-resizer:hover { background: ${GG_CONFIG.colors.takumiOrange} !important; }
            .gg-resizer-handle { width: 60px; height: 4px; background: rgba(255,255,255,0.3); border-radius: 4px; }
            
            .gg-section-group { background: ${GG_CONFIG.colors.sectionBg}; border: 1px solid ${GG_CONFIG.colors.border}; border-radius: 10px; margin-bottom: 10px; overflow: hidden; }
            .gg-section-title { 
                color: ${GG_CONFIG.colors.takumiOrange}; font-weight: bold; font-size: 1rem; 
                padding: 8px 16px; cursor: pointer; background: rgba(0,0,0,0.3); 
                display: flex; align-items: center; gap: 12px; user-select: none;
            }

            .gg-grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); 
                gap: 10px; 
                padding: 10px; 
            }
            
            .gg-tag-card { 
                background: #1e293b; border: 1px solid #334155; padding: 10px 14px; 
                border-radius: 8px; cursor: pointer; transition: all 0.2s; 
                display: flex; align-items: center; justify-content: space-between; gap: 8px;
                min-height: 36px;font-size: 0.9rem;
            }
            .gg-tag-card:hover { border-color: ${GG_CONFIG.colors.accent}; background: #263449; transform: translateY(-1px); }
            .gg-tag-card.editing-now { 
                border-color: ${GG_CONFIG.colors.editing}; 
                box-shadow: 0 0 20px rgba(244, 63, 94, 0.4); 
                background: rgba(244, 63, 94, 0.1) !important; 
            }
            
            .gg-input { 
                background: #0f172a; border: 1px solid #334155; color: white; padding: 14px; 
                border-radius: 10px; outline: none; font-family: 'JetBrains Mono', 'Consolas', monospace; 
                font-size: 0.95rem; transition: border-color 0.2s;
            }
            .gg-input:focus { 
                background: ${GG_CONFIG.colors.inputFocusBg} !important; 
                color: ${GG_CONFIG.colors.inputFocusText} !important; 
                border-color: ${GG_CONFIG.colors.takumiOrange}; 
            }
            
            .gg-btn { 
                padding: 14px 24px; border-radius: 10px; cursor: pointer; font-weight: bold; 
                border: none; transition: all 0.2s; display: flex; align-items: center; 
                justify-content: center; gap: 12px; font-size: 0.95rem; 
            }
            .gg-btn:active { transform: scale(0.97); }
            .gg-btn:disabled { opacity: 0.2; cursor: not-allowed; filter: grayscale(1); }
            
            .gg-drop-zone { 
                width: 320px; height: 320px; border: 2px dashed ${GG_CONFIG.colors.border}; 
                border-radius: 14px; display: flex; align-items: center; justify-content: center; 
                background: rgba(255,255,255,0.02); cursor: pointer; overflow: hidden; position: relative; 
                transition: all 0.3s;
            }
            .gg-drop-zone:hover { border-color: ${GG_CONFIG.colors.accent}; background: rgba(56, 189, 248, 0.05); }
            .gg-drop-preview { width: 100%; height: 100%; object-fit: contain; background: black; }
            
            .gg-error-banner { 
                background: ${GG_CONFIG.colors.danger}; color: white; padding: 16px 24px; 
                border-radius: 12px; font-weight: bold; font-size: 1rem; margin-bottom: 20px; 
                display: flex; align-items: center; gap: 14px; border-left: 6px solid rgba(0,0,0,0.3);
                animation: slideIn 0.3s ease-out;
            }
            @keyframes slideIn { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

            ::-webkit-scrollbar { width: 8px; height: 8px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
            ::-webkit-scrollbar-thumb:hover { background: #475569; }
        `;
        document.head.appendChild(style);
    }

    createMainModal() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'gg-modal-overlay';
        this.overlay.innerHTML = `
            <div class="gg-container">
                <div class="gg-header">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="background:${GG_CONFIG.colors.takumiOrange}; color:white; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:6px; font-weight:900;">匠</div>
                        <span style="font-weight: 900; font-size:1.4rem; letter-spacing: 0.05em;">Prompt Editor <span style="font-size:0.8rem; opacity:0.5; font-weight:normal; margin-left:10px;">ULTIMATE v${GG_CONFIG.version}</span></span>
                    </div>
                    <div id="gg-global-actions" style="display:flex; align-items:center; gap:10px; margin-left:auto; margin-right:20px;"></div>
                    <button id="gg-close" style="background:none; border:none; color:white; cursor:pointer; font-size:2.8rem; opacity:0.4; transition:0.2s;">&times;</button>
                </div>
                <div class="gg-content">
                    <div class="gg-sidebar" id="gg-sidebar"></div>
                    <div class="gg-main" id="gg-main-container">
                        <div class="gg-viewer-area" id="gg-viewer"></div>
                        <div class="gg-resizer" id="gg-resizer"><div class="gg-resizer-handle"></div></div>
                        <div class="gg-editor-area" id="gg-editor"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        const closeBtn = this.overlay.querySelector('#gg-close');
        closeBtn.onclick = () => this.overlay.style.display = 'none';
        closeBtn.onmouseover = () => closeBtn.style.opacity = '1';
        closeBtn.onmouseout = () => closeBtn.style.opacity = '0.4';
    }

    open() {
        this.overlay.style.display = 'flex';
        this.applyLayout();
        this.render();
    }

    // ==========================================
    // 🌟 新規YAMLファイル作成システム（完全版）
    // ==========================================
    showNewFileModal() {
        const modal = document.createElement('div');
        modal.className = 'gg-modal-overlay';
        modal.style.display = 'flex';
        modal.style.zIndex = '10000';
        
        modal.innerHTML = `
            <div class="gg-container" style="width: 540px; height: auto; padding: 25px; gap: 15px; border-top: 4px solid ${GG_CONFIG.colors.success}; box-shadow: 0 10px 40px rgba(0,0,0,0.8); background: #0f172a; border-radius: 12px;">
                <h3 style="margin: 0 0 15px 0; color: ${GG_CONFIG.colors.success}; font-size:1.3rem;">📄 新規YAMLファイルの作成</h3>
                <div style="font-size: 0.9rem; color: #cbd5e1; line-height: 1.6;">
                    新しくプロンプトを整理するためのYAMLファイルを作成します。<br><br>
                    <div style="background: rgba(251, 146, 60, 0.1); border-left: 4px solid ${GG_CONFIG.colors.takumiOrange}; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                        <span style="color: ${GG_CONFIG.colors.takumiOrange}; font-weight:bold;">💡 お気に入り(Fav) 連動ファイルの作り方</span><br>
                        ファイル名を <code>favorite[英字1文字][数字2桁]</code> という形式（例: <code>favoriteC00</code>, <code>favoriteD01</code>）で作成すると、システムが自動的にお気に入りパレットとして認識します。
                    </div>
                    <span style="color: #94a3b8; font-size:0.8rem;">
                        ※ 拡張子 (.yml) は自動で付与されます。<br>
                        ※ スラッシュ(/)を入れるとフォルダ分けも可能です（例: <code>my_folder/test_file</code>）。
                    </span>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 15px;">
                    <label style="font-size: 0.85rem; font-weight: bold; color: #94a3b8;">新しいファイル名 (必須)</label>
                    <input type="text" id="gg-new-file-name" class="gg-input" placeholder="例: favoriteC00 または my_prompts">
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 25px;">
                    <button class="gg-btn" style="background: #334155; color: white; padding: 10px 20px;" id="gg-new-file-cancel">キャンセル</button>
                    <button class="gg-btn" style="background: ${GG_CONFIG.colors.success}; color: white; padding: 10px 20px; font-weight: bold;" id="gg-new-file-create">作成する</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const input = document.getElementById('gg-new-file-name');
        input.focus();

        document.getElementById('gg-new-file-cancel').onclick = () => {
            modal.remove();
        };

        document.getElementById('gg-new-file-create').onclick = async () => {
            let inputName = input.value.trim();
            if (!inputName) {
                alert("ファイル名を入力してください。");
                input.focus();
                return;
            }

            // 🌟 修正：テキストエディタのハイライトバグを防ぐため、文字列経由で正規表現を定義
            const forbiddenChars = new RegExp('[\\\\:*?\\"<>|]');
            if (forbiddenChars.test(inputName)) {
                alert("ファイル名に使用できない文字が含まれています。");
                input.focus();
                return;
            }

            if (!inputName.toLowerCase().endsWith('.yml') && !inputName.toLowerCase().endsWith('.yaml')) {
                inputName += '.yml';
            }

            const createBtn = document.getElementById('gg-new-file-create');
            createBtn.disabled = true;
            createBtn.textContent = '作成中...';

            await this.createNewYamlFile(inputName, modal);
        };
    }

    async createNewYamlFile(fileName, modalElement) {
        // 基点となるパスを取得 (tagsフォルダのパス)
        let basePath = "";
        const samplePath = Object.values(this.filePaths)[0];
        
        if (samplePath) {
            const idx = samplePath.indexOf('/tags/');
            if (idx !== -1) {
                basePath = samplePath.substring(0, idx + 6); // ".../tags/" まで
            } else {
                basePath = samplePath.substring(0, samplePath.lastIndexOf('/') + 1);
            }
        } else {
            alert("基準となるパスが見つかりません。既存のファイルが1つも読み込まれていない可能性があります。");
            return;
        }

        // サブディレクトリ対応: ファイル名に余計な先頭スラッシュがあれば取る
        fileName = fileName.replace(/^\/+/, '');
        const fullPath = basePath + fileName;

        // ダミーデータの作成
        const dummyData = {
            "ダミーカテゴリ": {
                "ダミーボタン": ""
            }
        };

        const content = this.stringifyYaml(dummyData);
        const encodedContent = btoa(encodeURIComponent(content));

        try {
            const pathInput = document.getElementById('gg_save_path_in')?.querySelector('textarea');
            const contentInput = document.getElementById('gg_save_content_in')?.querySelector('textarea');
            const saveBtn = document.getElementById('gg_save_trigger_btn');

            if (pathInput && contentInput && saveBtn) {
                pathInput.value = fullPath;
                contentInput.value = encodedContent; 
                pathInput.dispatchEvent(new Event('input', { bubbles: true }));
                contentInput.dispatchEvent(new Event('input', { bubbles: true }));
                
                // 保存実行（Python側のmkdirが走ってフォルダごと自動生成される）
                saveBtn.click();
                
                // 少し待ってから再読み込みと画面の同期を行う
                setTimeout(async () => {
                    await this.loadAllYAMLs();
                    
                    const newFileKey = fileName.replace(/\.ya?ml$/i, '');
                    
                    // Favのルールにマッチするかチェックしてセレクトボックスを追従させる
                    const match = newFileKey.match(/^favorite([A-Z])(\d{2})$/i);
                    if (match) {
                        this.favChar = match[1].toUpperCase();
                        this.favNum = match[2];
                    }
                    
                    this.selectedFile = newFileKey;
                    this.editingItem = null;
                    this.isInitialLoad = true;
                    this.render();
                    
                    if (modalElement) modalElement.remove();
                }, 1500);

            } else {
                alert("[GG] 保存用UIハブが見つかりません。");
            }
        } catch (e) { 
            console.error("[GG] 新規作成エラー", e); 
            alert("エラーが発生しました。コンソールを確認してください。");
        }
    }


    getThumbnailPath(name, flag = null) {
        if (!this.selectedFile) return null;

        const yamlPath = this.filePaths[this.selectedFile];
        const baseDir = yamlPath.substring(0, yamlPath.lastIndexOf('/'));

        const specificFile = flag ? `${name} [${flag}].png` : null;
        const genericFile = `${name}.png`;

        return {
            specific: specificFile ? `${baseDir}/${specificFile}` : null,
            generic: `${baseDir}/${genericFile}`
        };
    }

    parseKey(fullKey) {
        if (!fullKey) return { name: "", flag: null };
        const match = fullKey.match(/\s*\[([CSOE])\]$/);
        if (match) {
            return {
                name: fullKey.replace(match[0], '').trim(),
                flag: match[1]
            };
        }
        return { name: fullKey.trim(), flag: null };
    }

    sanitizeInput(text) {
        return text.replace(/[’]/g, "'");
    }

    checkKeyDuplicate(inputName, inputFlag) {
        if (!this.editingItem) return false;
        const testKey = inputFlag ? `${inputName} [${inputFlag}]` : inputName;
        const { key, parentNode, isNew } = this.editingItem;
        
        if (isNew || testKey !== key) {
            return Object.keys(parentNode).includes(testKey);
        }
        return false;
    }

    // --- Rendering Engine ---
    render() {
        this.renderSidebar();
        if (this.selectedFile) {
            this.renderViewer();
            this.renderEditor();
        } else {
            document.getElementById('gg-viewer').innerHTML = `
                <div style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; opacity:0.5; color:#94a3b8;">
                    <div style="font-size:6rem;">📁</div>
                    <div style="font-size:1.4rem; font-weight:bold; margin-top:20px;">YAMLファイルを選択してください</div>
                </div>`;
            document.getElementById('gg-editor').innerHTML = '';
        }
        this.applyLayout();
    }

    renderSidebar() {
        const sidebar = document.getElementById('gg-sidebar');
        const favMap = this.getFavoriteMap();

        const isBFile = this.selectedFile && /^favoriteB\d{2}$/i.test(this.selectedFile);

        sidebar.innerHTML = `
            <div style="padding: 10px; border-bottom: 2px solid rgba(148, 163, 184, 0.3); margin-bottom: 10px; display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="font-size:0.8rem; color:${GG_CONFIG.colors.takumiOrange}; font-weight:bold;">Favorite </div>
                    <select id="fav-char" onchange="window.genesisGear.updateFavNum()" style="width:50px; background:${GG_CONFIG.colors.darkBg}; color:white; border:1px solid ${GG_CONFIG.colors.border}; border-radius:4px; padding:4px;">
                        <option value="">-</option>
                        ${Object.keys(favMap).sort().map(c => `<option value="${c}" ${this.favChar === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                    <select id="fav-num" onchange="window.genesisGear.loadFav()" style="width:60px; background:${GG_CONFIG.colors.darkBg}; color:white; border:1px solid ${GG_CONFIG.colors.border}; border-radius:4px; padding:4px;">
                        <option value="" ${this.favNum === '' ? 'selected' : ''}>--</option>
                        ${this.favChar && favMap[this.favChar] ? favMap[this.favChar].map(n => `<option value="${n}" ${this.favNum === n ? 'selected' : ''}>${n}</option>`).join('') : ''}
                    </select>
                </div>
                
                ${isBFile ? `
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <button class="gg-btn" onclick="window.genesisGear.handleExpressFavImport(false)" 
                            style="width: 100%; padding: 6px; background: rgba(56, 189, 248, 0.15); border: 1px solid ${GG_CONFIG.colors.accent}; color: ${GG_CONFIG.colors.accent}; font-size: 0.75rem; border-radius: 6px; cursor:pointer;">
                            📥 既存の末尾セットに「追記」
                        </button>
                        <button class="gg-btn" onclick="window.genesisGear.handleExpressFavImport(true)" 
                            style="width: 100%; padding: 6px; background: rgba(16, 185, 129, 0.15); border: 1px solid ${GG_CONFIG.colors.success}; color: ${GG_CONFIG.colors.success}; font-size: 0.75rem; border-radius: 6px; cursor:pointer;">
                            🗂️ 新しいセットを「増設して追加」
                        </button>
                    </div>
                ` : ''}
            </div>

            <div style="padding: 0 10px 10px 10px;">
                <button class="gg-btn" onclick="window.genesisGear.showNewFileModal()" 
                    style="width: 100%; padding: 8px; background: rgba(244, 63, 94, 0.1); border: 1px dashed ${GG_CONFIG.colors.editing}; color: ${GG_CONFIG.colors.editing}; font-size: 0.85rem; border-radius: 6px; cursor:pointer; font-weight: bold; transition: 0.2s;"
                    onmouseover="this.style.background='rgba(244, 63, 94, 0.2)'" onmouseout="this.style.background='rgba(244, 63, 94, 0.1)'">
                    📄 新規YAMLファイル作成
                </button>
            </div>

            <div id="gg-file-list" style="display:flex; flex-direction:column; gap:4px; padding:0 10px;"></div>
        `;

        const list = document.getElementById('gg-file-list');
        Object.keys(this.yamlData).sort().forEach(name => {
            if (/^(favorite)?[A-Z]\d{2}$/i.test(name)) return;

            const item = document.createElement('div');
            item.style.padding = '8px 10px';
            item.style.borderRadius = '4px';
            item.style.cursor = 'pointer';
            item.style.fontSize = '14px';
            
            item.className = `gg-side-item ${this.selectedFile === name ? 'active' : ''}`;
            item.textContent = name;
            item.onclick = () => {
                this.selectedFile = name;
                this.editingItem = null;
                this.isInitialLoad = true;
                this.render();
            };
            list.appendChild(item);
        });
    }

    getFavoriteMap() {
        const map = {};
        Object.keys(this.filePaths).forEach(key => {
            const match = key.match(/^favorite([A-Z])(\d{2})$/i);
            if (match) {
                const char = match[1].toUpperCase();
                const num = match[2];
                if (!map[char]) map[char] = [];
                map[char].push(num);
            }
        });
        return map;
    }

    updateFavNum() {
        this.favChar = document.getElementById('fav-char').value;
        this.favNum = ''; 
        
        if (this.selectedFile && this.selectedFile.startsWith('favorite')) {
            this.selectedFile = null;
            this.editingItem = null;
        }
        
        this.render();
    }

    loadFav() {
        this.favNum = document.getElementById('fav-num').value;
        
        if (this.favChar && this.favNum) {
            const target = `favorite${this.favChar}${this.favNum}`;
            this.selectedFile = target;
            this.editingItem = null;
            this.isInitialLoad = true;
            this.render(); 
        }
    }

    async handleExpressFavImport(isNewSet) {
        if (!this.selectedFile || !/^favoriteB\d{2}$/i.test(this.selectedFile)) {
            alert('取り込み先がB系列のFavoriteファイルではありません。');
            return;
        }

        const favData = this.getEpsFavorites();
        const favKeys = Object.keys(favData);
        const tagCount = favKeys.length;

        if (tagCount === 0) {
            alert('本家お気に入りにタグが見つかりませんでした。');
            return;
        }

        let yamlTarget = this.yamlData[this.selectedFile];
        if (!yamlTarget) {
            yamlTarget = {};
            this.yamlData[this.selectedFile] = yamlTarget;
        }
        const existingCategories = Object.keys(yamlTarget);
        let targetCategoryName = "";

        if (isNewSet || existingCategories.length === 0) {
            let nextSetNum = 1;
            while (yamlTarget[`セット${nextSetNum}`] !== undefined) {
                nextSetNum++;
            }
            targetCategoryName = `セット${nextSetNum}`;
        } else {
            targetCategoryName = existingCategories[existingCategories.length - 1];
        }

        const previewTags = favKeys.slice(0, 3).map(k => `・ ${k}`).join('\n') + (tagCount > 3 ? '\n・ ...他' : '');
        const modeText = isNewSet 
            ? `「${targetCategoryName}」を新設して保存しますか？` 
            : `既存のカテゴリ「${targetCategoryName}」に追加・保存しますか？`;

        const isOk = confirm(`本家EPSから【 ${tagCount} 件 】のお気に入りを検出しました。\n\n▼ 登録予定:\n${previewTags}\n\n現在のファイル（${this.selectedFile}）に、${modeText}`);
        
        if (!isOk) return;

        if (!yamlTarget[targetCategoryName]) {
            yamlTarget[targetCategoryName] = {};
        }

        Object.assign(yamlTarget[targetCategoryName], favData);

        try {
            await this.saveToFile();
            alert(`「${targetCategoryName}」に ${tagCount} 件のタグを保存しました！`);
            this.collapsedSections.delete(`${this.selectedFile}-${targetCategoryName}`);
            this.render();
        } catch (e) {
            console.error("[GG] 特急保存エラー:", e);
            alert("ファイルへの書き込みに失敗しました。");
        }
    }

    async deleteCategory(categoryName) {
        const yamlTarget = this.yamlData[this.selectedFile];
        const categories = Object.keys(yamlTarget);

        if (categories.length <= 1) {
            alert('このカテゴリーは削除できません。\n\nYAMLファイル内には最低1つのカテゴリー（セット）を残す必要があります。');
            return;
        }

        const isOk = confirm(`警告: カテゴリー「${categoryName}」と、中に含まれるタグを【完全に削除】しますか？\n(この操作は元に戻せません)`);
        if (!isOk) return;

        delete yamlTarget[categoryName];

        try {
            await this.saveToFile();
            this.editingItem = null;
            this.render();
        } catch (e) {
            console.error("[GG] カテゴリ削除エラー:", e);
            alert("削除後の保存処理に失敗しました。");
        }
    }

    getEpsFavorites() {
        const favData = {};

        const epsRaw = localStorage.getItem('eps_favs_v14');
        if (epsRaw) {
            try {
                const parsed = JSON.parse(epsRaw);
                if (Array.isArray(parsed)) {
                    parsed.forEach(item => {
                        if (item.t) favData[item.t] = item.v || item.t;
                    });
                    console.log("[GG] eps_favs_v14 からロード完了");
                    return favData; 
                }
            } catch (e) { console.warn("[GG] eps_favs_v14 解析エラー", e); }
        }

        const tempRaw = localStorage.getItem('temp_favs');
        if (tempRaw) {
            try {
                const parsed = JSON.parse(tempRaw);
                if (Array.isArray(parsed)) {
                    parsed.forEach(item => {
                        if (item.key) favData[item.key] = item.data || item.key;
                    });
                    console.log("[GG] temp_favs からロード完了（予備）");
                    return favData;
                }
            } catch (e) { console.warn("[GG] temp_favs 解析エラー", e); }
        }

        return favData;
    }

    countTags(node) {
        if (typeof node === 'string') return 1;
        if (typeof node === 'object' && node !== null) {
            let total = 0;
            Object.values(node).forEach(v => {
                total += this.countTags(v);
            });
            return total;
        }
        return 0;
    }

    renderViewer() {
        const viewer = document.getElementById('gg-viewer');
        const data = this.yamlData[this.selectedFile];
        viewer.innerHTML = '';

        const globalActions = document.getElementById('gg-global-actions');
        if (globalActions) {
            globalActions.innerHTML = '';
            if (this.selectedFile) {
                const wrapAllBtn = document.createElement('button');
                wrapAllBtn.innerText = "📦 すべてを新枠で包む";
                wrapAllBtn.style.cssText = "font-size:0.75rem; background:#1e293b; border:1px solid #0ea5e9; color:#38bdf8; border-radius:4px; padding:4px 8px; cursor:pointer;";
                wrapAllBtn.onclick = async () => {
                    const newName = prompt("すべての内容を包み込む「新しい大枠の名前」を入力してください:");
                    if (!newName || newName.trim() === "") return;
                    const wrap = {};
                    Object.entries(data).forEach(([k, v]) => { wrap[k] = v; delete data[k]; });
                    data[newName.trim()] = wrap;
                    await this.saveToFile(); this.render();
                };
                
                const unwrapBtn = document.createElement('button');
                unwrapBtn.innerText = "📤 外枠を消す";
                unwrapBtn.style.cssText = "font-size:0.75rem; background:#1e293b; border:1px solid #fbbf24; color:#fbbf24; border-radius:4px; padding:4px 8px; cursor:pointer;";
                unwrapBtn.onclick = async () => {
                    const keys = Object.keys(data);
                    if (keys.length === 0) return;
                    const targetKey = prompt("解除して中身を取り出す「外枠のカテゴリー名」を入力してください:", keys[0]);
                    if (!targetKey || !data[targetKey]) return;
                    if (!confirm(`外枠「${targetKey}」を解除して中身をルートに出しますか？\n（中身のデータは消えません）`)) return;
                    
                    const targetVal = data[targetKey];
                    let canUnwrap = true;
                    if (typeof targetVal === 'object' && targetVal !== null) {
                        Object.keys(targetVal).forEach(ck => {
                            if (data[ck] !== undefined && ck !== targetKey) {
                                alert(`ルートにすでに「${ck}」が存在するため、上書きを避けるべく展開を中断しました。`);
                                canUnwrap = false;
                            }
                        });
                        if (canUnwrap) {
                            Object.entries(targetVal).forEach(([ck, cv]) => { data[ck] = cv; });
                            delete data[targetKey];
                            await this.saveToFile(); this.render();
                        }
                    }
                };

                const addRootBtn = document.createElement('button');
                addRootBtn.innerText = "💡 大枠を新設";
                addRootBtn.style.cssText = "font-size:0.75rem; background:#1e293b; border:1px solid #10b981; color:#34d399; border-radius:4px; padding:4px 8px; cursor:pointer;";
                addRootBtn.onclick = async () => {
                    const newName = prompt("新設する大枠のカテゴリー名を入力してください:");
                    if (!newName || newName.trim() === "") return;
                    data[newName.trim()] = {};
                    await this.saveToFile(); this.render();
                };

                globalActions.append(wrapAllBtn, unwrapBtn, addRootBtn);
            }
        }

        if (this.selectedFile && this.selectedFile.startsWith('favorite')) {
            const buffer = JSON.parse(localStorage.getItem('gg_fav_buffer') || '[]');
            const hasFavs = buffer.length > 0;

            const favHeader = document.createElement('div');
            favHeader.style.cssText = `padding: 15px; border-bottom: 1px solid #334155; margin-bottom: 15px; background: rgba(16, 185, 129, 0.05); border-radius: 10px;`;
            
            favHeader.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <span style="font-weight:bold; color:${GG_CONFIG.colors.success};">★ ストック待機中</span>
                        <span style="font-size:0.85rem; color:#94a3b8; margin-left:10px;">${buffer.length}件</span>
                    </div>
                    <button id="gg-paste-favs-btn" class="gg-btn"
                        style="background:${hasFavs ? GG_CONFIG.colors.success : '#1e293b'}; 
                               color:${hasFavs ? 'white' : '#64748b'}; 
                               cursor:${hasFavs ? 'pointer' : 'not-allowed'}; 
                               padding: 8px 20px;"
                        ${hasFavs ? '' : 'disabled'}>
                        📥 最後のグループに貼り付け
                    </button>
                </div>
            `;
            viewer.appendChild(favHeader);

            const pasteBtn = favHeader.querySelector('#gg-paste-favs-btn');
            if (hasFavs) {
                pasteBtn.onclick = async () => {
                    let yamlTarget = this.yamlData[this.selectedFile];
                    let targetGroup = null;
                    const rootKeys = Object.keys(yamlTarget);
                    for (let i = rootKeys.length - 1; i >= 0; i--) {
                        if (typeof yamlTarget[rootKeys[i]] === 'object') {
                            targetGroup = yamlTarget[rootKeys[i]];
                            break;
                        }
                    }
                    if (!targetGroup) {
                        yamlTarget['ストック'] = {};
                        targetGroup = yamlTarget['ストック'];
                    }

                    buffer.forEach(item => { targetGroup[item.key] = item.data; });
                    localStorage.setItem('gg_fav_buffer', '[]');
                    await this.saveToFile();
                    this.render(); 
                };
            }
        }

        let sectionIdx = 0;
        let imgCache = {};
        try {
            const cacheRaw = localStorage.getItem('eps_image_status_cache');
            if (cacheRaw) imgCache = JSON.parse(cacheRaw);
        } catch(e) {}

        const drawNode = (node, parentContainer, path = "", depth = 0, realParent = null) => {
            for (const key in node) {
                const val = node[key];
                if (typeof val === 'object' && val !== null) {
                    const sectionId = `${path}-${key}`;
                    if (this.isInitialLoad && sectionIdx > 0) this.collapsedSections.add(sectionId);
                    sectionIdx++;
                    
                    const isCollapsed = this.collapsedSections.has(sectionId);
                    const group = document.createElement('div');
                    group.className = 'gg-section-group';
                    
                    let titleBg, titleColor, borderColor;
                    if (depth === 0) {
                        titleBg = 'linear-gradient(90deg, rgba(30, 58, 138, 0.6), rgba(30, 58, 138, 0.1))'; 
                        titleColor = '#93c5fd'; borderColor = GG_CONFIG.colors.border;
                        group.style.background = GG_CONFIG.colors.sectionBg; group.style.border = `1px solid ${borderColor}`; group.style.borderRadius = '10px'; group.style.marginBottom = '12px'; group.style.overflow = 'hidden';
                    } else {
                        titleBg = 'rgba(0, 0, 0, 0.3)'; 
                        titleColor = depth === 1 ? GG_CONFIG.colors.takumiOrange : (depth === 2 ? '#34d399' : '#c084fc');
                        borderColor = depth === 1 ? 'rgba(251, 146, 60, 0.4)' : (depth === 2 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(139, 92, 246, 0.4)');
                        group.style.marginLeft = '18px'; group.style.marginTop = '6px'; group.style.marginBottom = '4px'; group.style.border = 'none'; group.style.borderLeft = `2px solid ${borderColor}`; group.style.background = 'transparent'; group.style.overflow = 'visible';
                    }

                    const tagCount = this.countTags(val);

                    const header = document.createElement('div');
                    header.className = 'gg-section-title';
                    header.style.cssText = `display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box; background: ${titleBg}; color: ${titleColor}; border-radius: ${depth > 0 ? '6px' : '0'}; padding: ${depth > 0 ? '6px 12px' : '8px 16px'}; cursor: pointer;`;
                    
                    header.innerHTML = `
                        <div style="display: flex; align-items: center; flex: 1;">
                            <span style="width:20px; transition:0.2s; transform:rotate(${isCollapsed ? '-90deg' : '0deg'})">▼</span>
                            <span style="font-size: ${depth === 0 ? '1.05rem' : '0.9rem'}; font-weight: bold; letter-spacing: 0.02em;">${key} <span style="opacity: 0.7; font-size: 0.85em; font-weight: normal; margin-left: 4px;">(${tagCount})</span></span>
                        </div>
                        <div class="gg-cat-actions" style="display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; padding-left: 10px;"></div>
                    `;

                    header.onclick = (e) => {
                        if (e.target.closest('.gg-cat-actions')) return;
                        if (isCollapsed) this.collapsedSections.delete(sectionId);
                        else this.collapsedSections.add(sectionId);
                        this.renderViewer();
                    };
                    group.appendChild(header);

                    if (!isCollapsed) {
                        const actions = header.querySelector('.gg-cat-actions');

                        const btnDefs = [
                            { txt: "✏️ カテゴリ名修正", color: "#cbd5e1", border: "#475569", cb: async () => { const n=prompt("新しいカテゴリー名を入力してください:", key); if(n && n!==key) { const ent=Object.entries(realParent); for(const k in realParent) delete realParent[k]; for(const [k,v] of ent) realParent[k===key?n.trim():k] = v; await this.saveToFile(); this.render(); }}},
                            { txt: "💡 次へ新設", color: GG_CONFIG.colors.takumiOrange, border: GG_CONFIG.colors.takumiOrange, cb: async () => { const n=prompt("この直後に新設する「カテゴリー名」を入力してください:"); if(n && n.trim() !== "") { const ent=Object.entries(realParent); for(const k in realParent) delete realParent[k]; for(const [k,v] of ent) { realParent[k]=v; if(k===key) realParent[n.trim()]={}; } await this.saveToFile(); this.render(); }}},
                            { txt: "📥 内へ新設", color: "#a78bfa", border: "#8b5cf6", cb: async () => { const n=prompt("このカテゴリの『内側（子階層）』に新設するカテゴリー名を入力してください:"); if(n && n.trim() !== "") { val[n.trim()]={}; await this.saveToFile(); this.render(); }}},
                            
                            // 🌟 ここにソート機能を追加しました！
                            { txt: "🔀 内の項目をソート", color: "#38bdf8", border: "#0284c7", cb: async () => {
                                if (!val || typeof val !== 'object' || Array.isArray(val) || Object.keys(val).length <= 1) {
                                    alert('ソートする項目が足りません（2つ以上の項目が必要です）。');
                                    return;
                                }
                                if (!confirm(`カテゴリー「${key}」の直下にある項目（ボタンや子カテゴリ）を50音・アルファベット順にソートしますか？`)) return;
                                
                                // 1. 現在の中身を退避しつつ、キー（名前）で50音・数値順ソート
                                const ent = Object.entries(val);
                                ent.sort((a, b) => a[0].localeCompare(b[0], 'ja', { sensitivity: 'base', numeric: true }));
                                
                                // 2. 一度空にして、ソート済みの順序で再注入（これでYAML上の並び順が変わります）
                                for (const k in val) delete val[k];
                                for (const [k, v] of ent) val[k] = v;
                                
                                // 3. 保存して再描画
                                await this.saveToFile();
                                this.render();
                            }},

                            { txt: "❌ カテゴリ削除", color: "#fca5a5", border: "#7f1d1d", bg: "#450a0a", cb: async () => { 
                                if (realParent === data && Object.keys(data).length <= 1) {
                                    alert('このカテゴリーは削除できません。\n\nYAMLファイル内には最低1つのカテゴリーを残す必要があります。');
                                    return;
                                }
                                if(!confirm(`警告: カテゴリー「${key}」と中に含まれるタグを【完全に削除】しますか？\n(この操作は元に戻せません)`)) return; 
                                delete realParent[key]; 
                                await this.saveToFile(); 
                                this.editingItem = null; 
                                this.render(); 
                            }}
                        ];

                        btnDefs.forEach(b => {
                            const btn = document.createElement('button');
                            btn.innerText = b.txt;
                            btn.style.cssText = `font-size:0.7rem; background:${b.bg || '#334155'}; border:1px solid ${b.border}; color:${b.color}; border-radius:4px; padding:2px 6px; cursor:pointer; font-weight:normal;`;
                            btn.onclick = (e) => { e.stopPropagation(); b.cb(); };
                            actions.appendChild(btn);
                        });
                    }

                    const grid = document.createElement('div');
                    grid.className = 'gg-grid';
                    if (depth > 0) grid.style.padding = '8px 0 8px 12px';
                    if (isCollapsed) grid.style.display = 'none';

                    const addBtn = document.createElement('div');
                    addBtn.className = 'gg-tag-card';
                    addBtn.style.border = `2px dashed ${GG_CONFIG.colors.takumiOrange}`;
                    addBtn.style.background = 'rgba(251, 146, 60, 0.03)';
                    addBtn.innerHTML = `<span style="color:${GG_CONFIG.colors.takumiOrange}; font-weight:bold; font-size:0.85rem;">＋ 新規追加</span>`;
                    addBtn.onclick = () => {
                        this.editingItem = { parentNode: val, key: "", value: "", isNew: true, activeFlag: null };
                        this.pendingImageData = null; this.currentThumbnail = null; this.thumbnailExists = false; this.errorMessage = "";
                        this.renderEditor(); 
                        document.getElementById('gg-editor').scrollIntoView({ behavior: 'smooth' });
                    };
                    grid.appendChild(addBtn);

                    for (const subKey in val) {
                        if (typeof val[subKey] === 'string') {
                            const { name, flag } = this.parseKey(subKey);
                            const card = document.createElement('div');
                            const isSelected = (this.editingItem && this.editingItem.parentNode === val && this.editingItem.key === subKey);
                            card.className = `gg-tag-card ${isSelected ? 'editing-now' : ''}`;
                            card.style.display = 'flex'; card.style.justifyContent = 'space-between'; card.style.alignItems = 'center';

                            let displayName = name;
                            let rawValue = val[subKey] || "";
                            const hexMatch = name.match(/#([0-9a-fA-F]{3,8})/) || rawValue.match(/#([0-9a-fA-F]{3,8})/);
                            const rgbMatch = name.match(/rgba?\(.+?\)/) || rawValue.match(/rgba?\(.+?\)/);
                            let detectedColor = null;

                            if (hexMatch) detectedColor = hexMatch[0];
                            else if (rgbMatch) detectedColor = rgbMatch[0];

                            let colorBlockHtml = '';
                            if (detectedColor) {
                                if (name.match(/#([0-9a-fA-F]{3,8})/) || name.match(/rgba?\(.+?\)/)) {
                                    displayName = displayName.replace(new RegExp(`\\s*[\\[\\(\\{]?${detectedColor.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&')}[\\]\\)\\}]?`, 'g'), '');
                                    if (displayName.trim() === '') displayName = name;
                                }
                                colorBlockHtml = `<span class="gg-color-preview" style="display:inline-block; width:14px; height:14px; background:${detectedColor}; border:1px solid rgba(255,255,255,0.25); border-radius:3px; flex-shrink:0; margin-right:-2px; box-shadow:0 1px 3px rgba(0,0,0,0.4);"></span>`;
                            }

                            const cacheStatus = imgCache[subKey];
                            let mark = '◇'; let markColor = '#FFFFFF';
                            if (cacheStatus === 'none') { mark = '◇'; markColor = '#FFFFFF'; } 
                            else if (cacheStatus === 'G') { mark = '★'; markColor = '#facc15'; } 
                            else if (cacheStatus && Object.keys(GG_FLAGS).includes(cacheStatus)) { mark = '◉'; markColor = GG_FLAGS[cacheStatus]?.color || '#38bdf8'; } 
                            else if (cacheStatus !== undefined) { mark = '◉'; markColor = GG_FLAGS[flag]?.color || '#38bdf8'; }

                            card.innerHTML = `
                                <div style="display: flex; align-items: center; width: 100%; gap: 8px;">
                                    <span class="gg-thumb-icon" style="display: inline-flex !important; align-items: center !important; justify-content: center !important; font-size: 0.9rem !important; min-width: 25px !important; height: 25px !important; flex-shrink: 0 !important; border: 2px solid transparent !important; color: ${markColor} !important; box-sizing: border-box !important; line-height: 1 !important; visibility: visible;">${mark}</span>
                                    ${colorBlockHtml}
                                    <div style="display: flex; align-items: center; min-width: 0; flex: 1; height: auto; padding: 2px 0;">
                                        <span style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; word-break: break-all; line-height: 1.3;">${displayName}</span>
                                    </div>
                                    ${flag ? `<span style="display: flex; align-items: center; height: 20px; background:${GG_FLAGS[flag]?.color}; font-size:0.65rem; padding:0 5px; border-radius:4px; color:white; font-weight:bold; flex-shrink: 0;">${flag}</span>` : ''}
                                </div>
                            `;

                            const icon = card.querySelector('.gg-thumb-icon');
                            if (cacheStatus === undefined) {
                                const clickThumbData = this.getThumbnailPath(name.trim(), flag);
                                const testImg = new Image();
                                if (clickThumbData.specific) {
                                    testImg.onload = () => { imgCache[subKey] = flag || 'C'; localStorage.setItem('eps_image_status_cache', JSON.stringify(imgCache)); if (icon) { icon.textContent = '◉'; icon.style.color = GG_FLAGS[flag]?.color || '#38bdf8'; } };
                                    testImg.onerror = () => {
                                        const genericImg = new Image();
                                        genericImg.onload = () => { imgCache[subKey] = 'G'; localStorage.setItem('eps_image_status_cache', JSON.stringify(imgCache)); if (icon) { icon.textContent = '★'; icon.style.color = '#facc15'; } };
                                        genericImg.onerror = () => { imgCache[subKey] = 'none'; localStorage.setItem('eps_image_status_cache', JSON.stringify(imgCache)); };
                                        genericImg.src = `file=${clickThumbData.generic}?t=${Date.now()}`;
                                    };
                                    testImg.src = `file=${clickThumbData.specific}?t=${Date.now()}`;
                                } else {
                                    const genericName = name.trim();
                                    const allowedFlags = Object.keys(GG_FLAGS);
                                    const baseDir = this.filePaths[this.selectedFile].substring(0, this.filePaths[this.selectedFile].lastIndexOf('/'));
                                    const checkNextFlag = (index) => {
                                        if (index >= allowedFlags.length) {
                                            const genericImg = new Image();
                                            genericImg.onload = () => { imgCache[subKey] = 'G'; localStorage.setItem('eps_image_status_cache', JSON.stringify(imgCache)); if (icon) { icon.textContent = '★'; icon.style.color = '#facc15'; } };
                                            genericImg.onerror = () => { imgCache[subKey] = 'none'; localStorage.setItem('eps_image_status_cache', JSON.stringify(imgCache)); };
                                            genericImg.src = `file=${baseDir}/${genericName}.png?t=${Date.now()}`;
                                            return;
                                        }
                                        const currentChar = allowedFlags[index];
                                        const specificImg = new Image();
                                        specificImg.onload = () => { imgCache[subKey] = currentChar; localStorage.setItem('eps_image_status_cache', JSON.stringify(imgCache)); if (icon) { icon.textContent = '◉'; icon.style.color = GG_FLAGS[currentChar]?.color || '#38bdf8'; } };
                                        specificImg.onerror = () => { checkNextFlag(index + 1); };
                                        specificImg.src = `file=${baseDir}/${genericName} [${currentChar}].png?t=${Date.now()}`;
                                    };
                                    checkNextFlag(0);
                                }
                            }

                            card.onclick = () => {
                                document.querySelectorAll('.gg-tag-card').forEach(c => c.classList.remove('editing-now'));
                                card.classList.add('editing-now');
                                this.editingItem = { parentNode: val, key: subKey, value: val[subKey], isNew: false, activeFlag: flag };
                                this.pendingImageData = null; this.errorMessage = "";
                                const clickThumbData = this.getThumbnailPath(name.trim(), flag);
                                const currentStatus = imgCache[subKey];
                                if (currentStatus === 'G') { this.currentThumbnail = clickThumbData.generic.split('/').pop(); this.thumbnailExists = true; } 
                                else if (currentStatus && currentStatus !== 'none') { this.currentThumbnail = clickThumbData.specific ? clickThumbData.specific.split('/').pop() : clickThumbData.generic.split('/').pop(); this.thumbnailExists = true; } 
                                else { this.currentThumbnail = null; this.thumbnailExists = false; }
                                
                                this.renderEditor(); 
                            };
                            grid.appendChild(card);
                        }
                    }
                    group.appendChild(grid);

                    const childrenContainer = document.createElement('div');
                    childrenContainer.className = 'gg-section-children';
                    if (isCollapsed) childrenContainer.style.display = 'none';
                    group.appendChild(childrenContainer);
                    parentContainer.appendChild(group);
                    
                    for (const sk in val) {
                        if (typeof val[sk] === 'object' && val[sk] !== null) {
                            drawNode({ [sk]: val[sk] }, childrenContainer, sectionId, depth + 1, val);
                        }
                    }
                }
            }
        };

        drawNode(data, viewer, "", 0, data);
        this.isInitialLoad = false;
    }

    renderEditor() {
        const editor = document.getElementById('gg-editor');
        if (!this.editingItem) {
            editor.innerHTML = `
                <div style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; opacity:0.6; color:#94a3b8;">
                    <div style="font-size:5rem; margin-bottom:15px; filter:grayscale(1);">🛠️</div>
                    <div style="font-size:1.2rem; font-weight:bold;">アイテムを選択して内容を編集</div>
                </div>`;
            return;
        }
        
        const { key, value } = this.editingItem;
        const { name } = this.parseKey(key);

        const favBuffer = JSON.parse(localStorage.getItem('gg_fav_buffer') || '[]');
        const isFav = favBuffer.some(f => f.key === key && f.data === value);

        editor.innerHTML = `
            <div id="gg-error-container"></div>
            
            <div style="display:flex; gap:10px; flex:1; min-height:0;">
                <div style="flex:1; display:flex; flex-direction:column; gap:10px; border-right:1px solid rgba(255,255,255,0.05); padding-right:20px;">
                    
                    <div style="display:flex; gap:20px;">
                        <div style="flex:2; display:flex; flex-direction:column; gap:4px;">
                            <label style="font-size:0.8rem; color:#94a3b8; font-weight:bold;">名称 (YAML KEY)</label>
                            <input type="text" id="edit-name" class="gg-input" value="${name}" placeholder="...">
                        </div>
                        <div style="flex:3; display:flex; flex-direction:column; gap:4px;">
                            <label style="font-size:0.8rem; color:#94a3b8; font-weight:bold;">フラグ (CSOE)</label>
                            <div id="flag-container" style="display:flex; gap:10px; flex-wrap:wrap; padding-top:4px;"></div>
                        </div>
                    </div>

                    <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
                        <label style="font-size:0.8rem; color:#94a3b8; font-weight:bold;">実行プロンプト</label>
                        <textarea id="edit-val" class="gg-input" style="flex:1; resize:none; line-height:1.6; font-size:1rem;">${value}</textarea>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; padding-top:10px;">
                        <div style="display:flex; gap:10px;">
                            <button class="gg-btn" style="background:#450a0a; color:#fca5a5; border:1px solid #7f1d1d;" id="edit-delete">🗑 削除</button>
                            
                            <button class="gg-btn" id="edit-fav-toggle" 
                                style="background:${isFav ? 'rgba(251, 146, 60, 0.2)' : 'rgba(255,255,255,0.05)'}; 
                                       color:${isFav ? GG_CONFIG.colors.takumiOrange : '#94a3b8'}; 
                                       border: 1px solid ${isFav ? GG_CONFIG.colors.takumiOrange : '#334155'}; 
                                       box-shadow: ${isFav ? '0 0 15px rgba(251,146,60,0.4)' : 'none'}; 
                                       transition: all 0.3s;">
                                ${isFav ? '★ ストック済' : '☆ ストックする'}
                            </button>
                        </div>

                        <div style="display:flex; gap:16px;">
                            <button class="gg-btn" style="background:#334155; color:#cbd5e1;" id="edit-cancel">キャンセル</button>
                            <button class="gg-btn" style="background:${GG_CONFIG.colors.takumiOrange}; color:white; min-width:180px;" id="edit-apply">💾 保存</button>
                        </div>
                    </div>
                </div>

                <div style="width:340px; display:flex; flex-direction:column; gap:20px; flex-shrink:0;">
                    <label style="font-size:0.85rem; color:#94a3b8; font-weight:bold; letter-spacing:0.05em;">サムネイル画像 (320x320)</label>
                    <div id="gg-drop-zone" class="gg-drop-zone">
                        ${this.pendingImageData ? `
                            <div style="position:relative; width:100%; height:100%;">
                                <img src="${this.pendingImageData}" class="gg-drop-preview">
                                <div id="gg-image-badge" style="position:absolute; top:10px; right:10px; background:#f59e0b; color:white; padding:4px 10px; border-radius:8px; font-size:0.75rem; font-weight:bold;">
                                    未保存
                                </div>
                            </div>
                        `
                        :
                        this.thumbnailExists && this.currentThumbnail ? `
                            <div style="position:relative; width:100%; height:100%;">
                                <img src="file=${this.filePaths[this.selectedFile].replace(/[^/]+$/, '')}${this.currentThumbnail}?t=${Date.now()}" class="gg-drop-preview">
                                <div id="gg-image-badge" style="position:absolute; top:10px; right:10px; background:#10b981; color:white; padding:4px 10px; border-radius:8px; font-size:0.75rem; font-weight:bold;">
                                    登録済み
                                </div>
                            </div>
                        `
                        :
                        `<div style="text-align:center; opacity:0.3;" id="drop-hint">
                            <div style="font-size:4.5rem;">🖼️</div>
                            <div style="margin-top:10px; font-weight:bold;">画像をドロップ<br><span style="font-size:0.8rem;">またはクリックして選択</span></div>
                         </div>`}
                    </div>

                    <div style="padding:18px; background:rgba(15, 23, 42, 0.8); border-radius:14px; border:1px solid ${GG_CONFIG.colors.accent}; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);">
                        <div style="font-size:0.75rem; color:${GG_CONFIG.colors.accent}; font-weight:bold; margin-bottom:8px; letter-spacing:0.05em;">保存ファイル名プレビュー</div>
                        <div id="gg-filename-text" style="font-family:'JetBrains Mono', monospace; font-size:1.1rem; font-weight:bold; word-break:break-all; color:white;">--</div>
                    </div>

                    <button class="gg-btn" style="background:${GG_CONFIG.colors.accent}; color:#0f172a; width:100%; height:60px; font-size:1.1rem; box-shadow: 0 4px 12px rgba(56, 189, 248, 0.3);" id="btn-save-image">📷 画像のみを保存</button>
                    <div style="font-size:0.75rem; color:#64748b; text-align:center; line-height:1.4;">
                        ※YAMLには反映されず、画像ファイルのみを<br>出力フォルダへ保存します。
                    </div>
                </div>
            </div>
        `;

        this.renderFlags();
        this.initEditorEvents();
        this.syncState();
    }

    renderFlags() {
        const fc = document.getElementById('flag-container');
        if (!fc) return;
        fc.innerHTML = '';
        
        Object.entries(GG_FLAGS).forEach(([fK, fD]) => {
            const b = document.createElement('button');
            const isActive = (this.editingItem.activeFlag === fK);
            
            Object.assign(b.style, {
                minWidth: '48px', height: '48px', borderRadius: '10px',
                border: `2px solid ${isActive ? fD.color : '#334155'}`,
                background: isActive ? fD.color : 'rgba(255,255,255,0.03)',
                color: isActive ? 'white' : '#94a3b8',
                cursor: 'pointer', fontWeight: '900', fontSize: '1.1rem',
                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            });

            b.textContent = fK;
            b.title = fD.desc;

            b.onclick = () => {
                this.editingItem.activeFlag = (this.editingItem.activeFlag === fK) ? null : fK;
                this.renderFlags(); 
                this.syncState();
            };
            fc.appendChild(b);
        });
    }

    initEditorEvents() {
        const nameInput = document.getElementById('edit-name');
        const valInput = document.getElementById('edit-val');
        
        nameInput.oninput = () => this.syncState();
        valInput.oninput = () => this.syncState();
        
        const dz = document.getElementById('gg-drop-zone');
        dz.ondragover = (e) => { e.preventDefault(); dz.style.borderColor = GG_CONFIG.colors.accent; dz.style.background = 'rgba(56, 189, 248, 0.1)'; };
        dz.ondragleave = () => { dz.style.borderColor = GG_CONFIG.colors.border; dz.style.background = 'rgba(255,255,255,0.02)'; };
        dz.ondrop = (e) => { e.preventDefault(); this.processImage(e.dataTransfer.files[0]); };
        dz.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.png,.jpg,.jpeg,.gif,.webp';
            input.onchange = (e) => this.processImage(e.target.files[0]);
            input.click();
        };

        document.getElementById('edit-cancel').onclick = () => { this.editingItem = null; this.render(); };
        document.getElementById('edit-delete').onclick = () => this.handleDelete();
        document.getElementById('edit-apply').onclick = () => this.handleApplyYaml();
        document.getElementById('btn-save-image').onclick = () => this.handleSaveImageOnly();
        const favToggleBtn = document.getElementById('edit-fav-toggle');
        if (favToggleBtn) {
            favToggleBtn.onclick = () => {
                let favs = JSON.parse(localStorage.getItem('gg_fav_buffer') || '[]');
                const currentKey = this.editingItem.key;
                const currentData = this.editingItem.value;

                const index = favs.findIndex(f => f.key === currentKey && f.data === currentData);
                if (index > -1) {
                    favs.splice(index, 1); 
                } else {
                    favs.push({ key: currentKey, data: currentData }); 
                }
                localStorage.setItem('gg_fav_buffer', JSON.stringify(favs));
                
                this.renderEditor(); 
            };
        }
    }

    syncState() {
        const nameInput = document.getElementById('edit-name');
        const name = nameInput?.value.trim() || "";
        const flag = this.editingItem?.activeFlag;
        
        const textElem = document.getElementById('gg-filename-text');
        if (textElem) {
            textElem.textContent = name ? (flag ? `${name} [${flag}].png` : `${name}.png`) : "--";
        }

        // 入力中のプロンプト値を取得
        const valInput = document.getElementById('edit-val');
        const currentVal = valInput ? valInput.value : "";

        // 🚫 禁則文字のルール定義
        const forbidden = [
            { check: (s) => s.includes("'"), msg: "シングルクォート（'）" },
            { check: (s) => s.includes('"'), msg: "ダブルクォート（\"）" },
            { check: (s) => s.includes('@'), msg: "アットマーク（@）" },
            { check: (s) => s.includes('%%'), msg: "連続パーセント（%%）" }
        ];

        let forbiddenError = null;
        for (const rule of forbidden) {
            if (rule.check(name) || rule.check(currentVal)) {
                forbiddenError = `システム制約: ${rule.msg} は使用できません`;
                break;
            }
        }

        const errorContainer = document.getElementById('gg-error-container');
        
        // 禁則文字エラーを最優先で表示、次に重複エラー
        if (forbiddenError) {
            this.errorMessage = forbiddenError;
            if (errorContainer) errorContainer.innerHTML = `<div class="gg-error-banner"><span>⚠️</span> ${this.errorMessage}</div>`;
        } else if (this.checkKeyDuplicate(name, flag)) {
            this.errorMessage = `重複エラー:「${name}${flag ? ' ['+flag+']' : ''}」は既に使用されています。`;
            if (errorContainer) errorContainer.innerHTML = `<div class="gg-error-banner"><span>⚠️</span> ${this.errorMessage}</div>`;
        } else {
            this.errorMessage = "";
            if (errorContainer) errorContainer.innerHTML = "";
        }

        let isChanged = false;
        if (this.editingItem) {
            const { name: originalName } = this.parseKey(this.editingItem.key);
            const isNameChanged = (name !== originalName.trim());

            const valInput = document.getElementById('edit-val');
            const currentVal = valInput ? valInput.value : "";
            const originalVal = this.editingItem.value || "";
            const isValChanged = (currentVal !== originalVal);

            isChanged = (isNameChanged || isValChanged);
        }

        const applyBtn = document.getElementById('edit-apply');
        if (applyBtn) {
            applyBtn.disabled = (!!this.errorMessage || !name || !isChanged);
            applyBtn.style.opacity = applyBtn.disabled ? "0.4" : "1";
        }
        
        const imgBtn = document.getElementById('btn-save-image');
        if (imgBtn) {
            imgBtn.disabled = (!this.pendingImageData || !name);
        }
    }

    processImage(file) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let canvas = document.createElement('canvas');
                let ctx = canvas.getContext('2d');
                
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                let currentWidth = img.width;
                let currentHeight = img.height;
                
                while (currentWidth > GG_CONFIG.thumbnailSize * 2 || currentHeight > GG_CONFIG.thumbnailSize * 2) {
                    currentWidth *= 0.5;
                    currentHeight *= 0.5;
                    canvas.width = currentWidth;
                    canvas.height = currentHeight;
                    ctx.drawImage(img, 0, 0, currentWidth, currentHeight);
                    img.src = canvas.toDataURL('image/png'); 
                }

                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = finalCanvas.height = GG_CONFIG.thumbnailSize;
                const finalCtx = finalCanvas.getContext('2d');
                
                finalCtx.imageSmoothingEnabled = true;
                finalCtx.imageSmoothingQuality = 'high';
                
                finalCtx.fillStyle = 'black';
                finalCtx.fillRect(0, 0, GG_CONFIG.thumbnailSize, GG_CONFIG.thumbnailSize);

                const scale = Math.min(GG_CONFIG.thumbnailSize / currentWidth, GG_CONFIG.thumbnailSize / currentHeight);
                const nw = currentWidth * scale, nh = currentHeight * scale;
                const nx = (GG_CONFIG.thumbnailSize - nw) / 2, ny = (GG_CONFIG.thumbnailSize - nh) / 2;
                
                finalCtx.drawImage(img, nx, ny, nw, nh);
                
                this.pendingImageData = finalCanvas.toDataURL('image/png');
                this.renderEditor();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    async handleApplyYaml() {
        const rawName = document.getElementById('edit-name').value.trim();
        const newVal = document.getElementById('edit-val').value;

        // エラー状態（禁則文字や重複）のまま強引に保存されそうになったら弾く
        if (this.errorMessage) {
            const errorContainer = document.getElementById('gg-error-container');
            if (errorContainer) {
                errorContainer.innerHTML = `<div class="gg-error-banner"><span>⚠️</span>${this.errorMessage}</div>`;
            }
            return;
        }
        
        const flag = this.editingItem.activeFlag;
        if (!rawName) return;
        
        const finalKey = this.editingItem.activeFlag ? `${rawName} [${this.editingItem.activeFlag}]` : rawName;
        const { parentNode, key, isNew } = this.editingItem;

        const oldFileName = key ? (this.parseKey(key).flag ? `${this.parseKey(key).name} [${this.parseKey(key).flag}].png` : `${this.parseKey(key).name}.png`) : null;
        const newFileName = flag ? `${rawName} [${flag}].png` : `${rawName}.png`

        if (isNew) {
            parentNode[finalKey] = newVal;
        } else {
            const updated = {};
            Object.keys(parentNode).forEach(k => {
                if (k === key) updated[finalKey] = newVal;
                else updated[k] = parentNode[k];
            });
            Object.keys(parentNode).forEach(k => delete parentNode[k]);
            Object.assign(parentNode, updated);
        }
        
        await this.saveToFile();

        if (!isNew && key && key !== finalKey) {
            this.markEpsCacheForUpdate(key); 
        }
        this.markEpsCacheForUpdate(finalKey); 

        this.editingItem = null;
        this.render();
    }

    handleSaveImageOnly() {
        const nameInput = document.getElementById('edit-name');
        const name = nameInput ? nameInput.value.trim() : "";
        if (!name || !this.pendingImageData) return;

        const flag = this.editingItem.activeFlag;
        const fileName = flag ? `${name} [${flag}].png` : `${name}.png`;
        const textElem = document.getElementById('gg-filename-text');
        const originalColor = textElem.style.color;

        const imgNameIn = document.getElementById('gg_img_name_in')?.querySelector('textarea');
        const imgDataIn = document.getElementById('gg_img_data_in')?.querySelector('textarea');
        const saveTrigger = document.getElementById('gg_img_save_trigger_btn');
        const yamlPathIn = document.getElementById('gg_save_path_in')?.querySelector('textarea');

        if (imgNameIn && imgDataIn && saveTrigger && yamlPathIn) {
            yamlPathIn.value = this.filePaths[this.selectedFile];
            imgNameIn.value = fileName;
            imgDataIn.value = this.pendingImageData;

            yamlPathIn.dispatchEvent(new Event('input', { bubbles: true }));
            imgNameIn.dispatchEvent(new Event('input', { bubbles: true }));
            imgDataIn.dispatchEvent(new Event('input', { bubbles: true }));

            setTimeout(() => {
                saveTrigger.click();

                try {
                    const cacheKey = 'eps_image_status_cache';
                    const cacheRaw = localStorage.getItem(cacheKey);
                    let cache = cacheRaw ? JSON.parse(cacheRaw) : {};
                    
                    if (!cache['_gg_updates']) cache['_gg_updates'] = [];
                    
                    const baseName = name;
                    const variations = [baseName, `${baseName} [C]`, `${baseName} [S]`, `${baseName} [O]`, `${baseName} [E]`];

                    variations.forEach(v => {
                        if (!cache['_gg_updates'].includes(v)) {
                            cache['_gg_updates'].push(v);
                        }
                        if (flag) {
                            if (v === `${baseName} [${flag}]`) {
                                cache[v] = flag; 
                            }
                        } else {
                            if (cache[v] === 'none' || cache[v] === undefined) {
                                cache[v] = 'G';
                            }
                        }
                    });

                    if (this.editingItem && this.editingItem.key) {
                        cache[this.editingItem.key] = flag ? flag : 'G';
                    }

                    localStorage.setItem(cacheKey, JSON.stringify(cache));
                } catch (e) {
                    console.error("[GG] ローカルキャッシュの即時上書きに失敗:", e);
                }

                textElem.style.color = GG_CONFIG.colors.success;
                textElem.textContent = `SAVED: ${fileName}`;
                
                this.pendingImageData = null; 
                this.currentThumbnail = fileName;
                this.thumbnailExists = true;

                const badge = document.getElementById('gg-image-badge');
                if (badge) {
                    badge.textContent = '登録済み';
                    badge.style.background = GG_CONFIG.colors.success; 
                }

                this.renderViewer();

                this.syncState();

                setTimeout(() => {
                    if (this.editingItem) {
                        textElem.style.color = originalColor;
                        this.syncState();
                    }
                }, 2500);
            }, 100);
        } else {
            textElem.style.color = GG_CONFIG.colors.danger;
            textElem.textContent = "ERROR: Hub Not Found";
        }
    }

    async handleDelete() {
        const parentNode = this.editingItem.parentNode;
        if (Object.keys(parentNode).length <= 1) {
            alert('このセクションの最後の項目は削除できません。\n\nYAML構造が壊れる可能性があります。');
            return;
        }

        if (!confirm("この項目を完全に削除しますか？\n(この操作はYAMLに即座に反映されます)")) return;

        const { name, flag } = this.parseKey(this.editingItem.key);
        const fileName = flag ? `${name} [${flag}].png` : `${name}.png`;

        delete parentNode[this.editingItem.key];

        await this.saveToFile();

        this.markEpsCacheForUpdate(this.editingItem.key);

        this.editingItem = null;
        this.render();
    }

    markEpsCacheForUpdate(yamlKey) {
        try {
            if (!yamlKey) return;
            const cacheKey = 'eps_image_status_cache';
            const cacheRaw = localStorage.getItem(cacheKey);
            let cache = cacheRaw ? JSON.parse(cacheRaw) : {};

            delete cache[yamlKey];

            if (!cache['_gg_updates']) {
                cache['_gg_updates'] = [];
            }
            if (!cache['_gg_updates'].includes(yamlKey)) {
                cache['_gg_updates'].push(yamlKey);
            }

            localStorage.setItem(cacheKey, JSON.stringify(cache));
            console.log(`[GG] EPSへ更新フラグを立てました: ${yamlKey}`);

        } catch (e) {
            console.error("[GG] EPSキャッシュのフラグ書き込みに失敗", e);
        }
    }
}

if (typeof onUiLoaded !== 'undefined') { 
    onUiLoaded(() => { 
        if (!window.genesisGear) window.genesisGear = new GenesisGearUI(); 
    }); 
} else if (!window.genesisGear) { 
    window.genesisGear = new GenesisGearUI(); 
}