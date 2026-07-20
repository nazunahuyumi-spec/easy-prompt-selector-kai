/* --- EasyPromptSelector: EPS-Kai Core Version (Free) --- */

const TAG_PREFIX_MAP = {
    '[C]': { icon: '👤', label: 'Character' },
    '[S]': { icon: '❤️', label: 'Series/Style' },
    '[O]': { icon: '👕', label: 'Outfit' },
    '[E]': { icon: '💎', label: 'Effect/Accessory' },
};

const IMAGE_BADGE_MAP = {
    'C': { label: '◉ C', color: '#3b82f6' },
    'S': { label: '◉ S', color: '#10b981' },
    'O': { label: '◉ O', color: '#f59e0b' },
    'E': { label: '◉ E', color: '#8b5cf6' },
    'G': { label: '★ G', color: '#facc15' }
};

const VISUAL_LAYER_CONFIG = {
    styles: {
        normal: { bg: 'linear-gradient(90deg, rgba(59,130,246,0.30), rgba(59,130,246,0.05))', border: 'rgba(59,130,246,0.35)' },
        lora: { bg: 'rgba(168,85,247,0.18)', border: 'rgba(168,85,247,0.45)' },
        macro: { bg: 'rgba(34,197,94,0.16)', border: 'rgba(34,197,94,0.42)' },
        search: { bg: 'rgba(251,191,36,0.16)', border: 'rgba(251,191,36,0.42)' },
        right: { bg: 'linear-gradient(270deg, rgba(59,130,246,0.30), rgba(59,130,246,0.05))', border: 'rgba(248,113,113,0.75)' },
        group: { bg: 'rgba(249,115,22,0.16)', border: 'rgba(249,115,22,0.42)' },
        unknown: { bg: 'rgba(120,120,120,0.18)', border: 'rgba(180,180,180,0.35)' },
        blake: { bg: 'rgba(255,80,120,0.18)', border: 'rgba(255,80,120,0.45)' }
    },
    rules: [
        { name: 'BLAKE', match: (t, label) => label.toLowerCase().includes('blake'), style: 'blake' },
        { name: 'LORA', match: (t) => t.includes('<lora:'), style: 'lora' },
        { name: 'SEARCH', match: (t) => t.startsWith('%%SEARCH:'), style: 'search' },
        { name: 'MACRO', match: (t) => /^%%(NM|RM)/.test(t), style: 'macro' },
        { name: 'RIGHT', match: (t) => /^%%.*%%$/i.test(t) && !/^%%(NM\d+|RM\d+|SEARCH:.*)%%$/i.test(t), style: 'right' },
        { name: 'GROUP', match: (t) => t.startsWith('@') && t.endsWith('@'), style: 'group' },
        { name: 'UNKNOWN', match: (t, label) => label === t, style: 'unknown' }
    ]
};

class EPSElementBuilder {
    static baseButton(text, { size = 'sm', color = 'primary' }) {
        const btn = document.createElement('button');
        btn.className = `gr-button gr-button-${size} gr-button-${color} ${size} ${color}`;
        btn.textContent = text; btn.type = 'button'; btn.style.margin = '2px'; btn.style.borderRadius = '4px'; btn.style.padding = '4px 8px'; btn.style.fontWeight = '700'; btn.style.transition = 'all 0.2s ease';
        this.applyColor(btn, color);
        return btn;
    }

    static applyColor(btn, color) {
        const styles = {
            'primary': { bg: 'var(--button-primary-background-fill)', text: 'var(--button-primary-text-color)', border: '1px solid transparent' },
            'secondary': { bg: 'var(--button-secondary-background-fill)', text: 'var(--button-secondary-text-color)', border: '1px solid var(--button-secondary-border-color)' },
            'macro-nm': { bg: '#10b981', text: 'white', border: '1px solid transparent' },
            'macro-rm': { bg: '#f59e0b', text: 'white', border: '1px solid transparent' },
            'macro-empty': { bg: 'var(--button-secondary-background-fill)', text: 'var(--body-text-color-subdued)', border: '1px solid var(--button-secondary-border-color)' },
            'macro-edit': { bg: '#ef4444', text: 'white', border: '2px solid white' },
            'fav-edit': { bg: '#fbbf24', text: 'black', border: '2px solid white' },
            'neg-active': { bg: '#dc2626', text: 'white', border: '1px solid #f87171' },
            'radio-active': { bg: '#10b981', text: 'white', border: '1px solid transparent' }
        };
        const s = styles[color] || styles['secondary'];
        btn.style.background = s.bg; btn.style.color = s.text; btn.style.border = s.border; btn.style.boxShadow = 'none'; btn.style.textShadow = 'none';
    }

    static tagFields(depth) {
        const f = document.createElement('div'); f.style.display = 'flex'; f.style.flexDirection = 'column'; f.style.width = '100%'; f.style.borderRadius = '6px'; f.style.padding = '6px'; f.style.margin = '6px 0'; f.style.border = '1px dashed #ff9800'; f.style.backgroundColor = 'rgba(255, 152, 0, 0.03)'; f.style.marginLeft = depth > 0 ? '12px' : '0px';
        return f;
    }
}

// プロンプトのトグル入力＆末尾スクロール追従を行う関数
function togglePromptAndScroll(textarea, tag) {
    let val = textarea.value;

    // 正規表現で「すでに同じタグが含まれているか」をチェック
    // （前後のカンマやスペースも含めて正確に判定します）
    const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|,)\\s*${escapeRegExp(tag)}\\s*(,|$)`, 'i');

    if (regex.test(val)) {
        // 【トグルOFF】既に存在する場合は削除
        val = val.replace(regex, (match, p1, p2) => {
            // 前後にカンマがあった場合は1つ残す
            return (p1 === ',' && p2 === ',') ? ', ' : '';
        });
        // 先頭や末尾に残った余分なカンマ・スペースを掃除
        val = val.replace(/^[\s,]+|[\s,]+$/g, '');
    } else {
        // 【トグルON】存在しない場合は末尾に追加
        if (val && !val.match(/,\s*$/)) {
             val += ', ';
        }
        val += tag;
    }

    textarea.value = val;
    updateInput(textarea); // Gradioに値の変更を通知

    // 【カーソル＆スクロール追従】
    // Gradioの描画更新タイミングとズラすため setTimeout を使用
    setTimeout(() => {
        textarea.focus(); // テキストエリアをアクティブにする
        textarea.selectionStart = textarea.value.length; // カーソルを一番最後に移動
        textarea.selectionEnd = textarea.value.length;
        textarea.scrollTop = textarea.scrollHeight; // スクロールバーを一番下へ
    }, 10);
}
// 拡張プラグインからアクセスできるようにグローバル化
window.EPSElementBuilder = EPSElementBuilder;

class EasyPromptSelector {
    constructor(yaml) {
        this.yaml = yaml || window.jsyaml; this.visible = false; this.isNegMode = false; this.lastSelected = null;
        this.NM_COUNT = 10; this.RM_COUNT = 10; this.HISTORY_COUNT = 20;
        this.AREA_ID = 'eps-v14-area'; this.CONTENT_ID = 'eps-v14-content'; this.SEARCH_ID = 'eps-v14-search-results'; this.PREVIEW_ID = 'eps-v14-thumbnail-preview'; this.SELECT_ID = 'eps-v14-file-select'; this.PATH_FILE = 'tmp/easyPromptSelector.txt';
        this.STORAGE_KEY = 'eps_history_v14'; this.MACRO_STORAGE_KEY = 'eps_macros_v14'; this.LABEL_STORAGE_KEY = 'eps_labels_v14'; this.FAV_STORAGE_KEY = 'eps_favs_v14';
        this.searchCache = {}; this.tags = {}; this.tagFilePaths = {}; this.allButtons = []; this.editingMacro = null; this.editingContent = ""; this.isFavEditing = false; this.imageCache = {}; 
        
        // 拡張プラグイン用のデータ格納領域（空のまま保持）
        this.radioSelections = {}; 
        this.sliderSelections = {}; 
        this.epsSettings = { fixBatchRandom: false }; 

        const savedH = localStorage.getItem(this.STORAGE_KEY); this.history = savedH ? JSON.parse(savedH) : [];
        const savedM = localStorage.getItem(this.MACRO_STORAGE_KEY); this.macros = savedM ? JSON.parse(savedM) : {};
        const savedL = localStorage.getItem(this.LABEL_STORAGE_KEY); this.macroLabelMap = savedL ? JSON.parse(savedL) : {};
        const savedF = localStorage.getItem(this.FAV_STORAGE_KEY); this.favorites = savedF ? JSON.parse(savedF) : [];
    }

    countTags(node) {
        if (typeof node === 'string') return 1; if (Array.isArray(node)) return node.length;
        if (typeof node === 'object' && node !== null) { let total = 0; Object.values(node).forEach(v => { total += this.countTags(v); }); return total; }
        return 0;
    }

    async init() {
        if (!this.yaml && window.jsyaml) this.yaml = window.jsyaml;
        if (this.autoSyncTimer) { clearInterval(this.autoSyncTimer); this.autoSyncTimer = null; }

        this.tags = await this.parseFiles(); this.allButtons = [];
        await new Promise(r => setTimeout(r, 0));

        const oldArea = document.getElementById(this.AREA_ID); if (oldArea) oldArea.remove();
        const target = gradioApp().getElementById('txt2img_toprow') || gradioApp().querySelector('.form'); if (!target) return;

        const newArea = this.render(); target.after(newArea);

        let quickRadioArea = document.getElementById('eps-quick-radio-area-standalone');
        if (!quickRadioArea) {
            quickRadioArea = document.createElement('div');
            quickRadioArea.id = 'eps-quick-radio-area-standalone';
            quickRadioArea.style.display = 'none'; 
            quickRadioArea.style.width = '100%';
            quickRadioArea.style.padding = '6px 8px';
            quickRadioArea.style.marginBottom = '6px';
            quickRadioArea.style.border = '1px solid rgba(16,185,129,0.5)';
            quickRadioArea.style.borderRadius = '6px';
            quickRadioArea.style.background = 'rgba(16,185,129,0.08)';
            quickRadioArea.style.flexWrap = 'wrap';
            quickRadioArea.style.alignItems = 'flex-start';
            quickRadioArea.style.gap = '8px';
        }            
        newArea.before(quickRadioArea);


        const prevSelect = document.getElementById(this.SELECT_ID)?.value; this.updateSelectDropdown(prevSelect);
        if (this.visible) newArea.style.display = 'block';

        this.setupInterceptor(); this.setupPromptWatchers(); this.renderHistoryAndMacros(); 
        
        // 🌟 拡張プラグイン（Extra）が存在する場合のみ描画処理をパスする
        if (typeof window.epsKaiExtraInit === 'function') {
            window.epsKaiExtraInit(this, quickRadioArea);
        }

        this.refreshButtonStyles();

        this.writeToCommunicationBox();
        this.autoSyncTimer = setInterval(() => { this.writeToCommunicationBox(); }, 2000);
    }

    updateSelectDropdown() {
        const select = document.getElementById(this.SELECT_ID); if (!select) return;
        const keys = Object.keys(this.tags).filter(k => k !== 'radio_setup' && k !== 'slider_setup');
        const frag = document.createDocumentFragment();
        const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = '選択してください'; frag.appendChild(placeholder);
        keys.forEach(k => { const opt = document.createElement('option'); opt.value = k; opt.textContent = k; frag.appendChild(opt); });
        select.replaceChildren(frag); select.value = '';
    }

    async parseFiles() {
        try {
            const getCacheBuster = () => `cb=${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const res = await fetch(`file=${this.PATH_FILE}?${getCacheBuster()}`);
            if (!res.ok) return {}; const text = await res.text(); if (!text || text.trim() === "") return {};
            const paths = text.split(/\r\n|\n/).filter(p => p.trim()); const tags = {}; this.tagFilePaths = {}; 
            for (const path of paths) {
                const fn = path.split('/').pop().split('.').shift(); this.tagFilePaths[fn] = path; 
                try {
                    const response = await fetch(`file=${path}?${getCacheBuster()}`); if (!response.ok) continue;
                    const d = await response.text();
                    this.yaml.loadAll(d, (doc) => { if (!doc) return; if (tags[fn]) tags[fn] = {...tags[fn], ...doc}; else tags[fn] = doc; });
                } catch (err) {}
            }
            return tags;
        } catch (e) { return {}; }
    }

    setupPromptWatchers() {
        const ids = ['txt2img_prompt', 'txt2img_neg_prompt', 'img2img_prompt', 'img2img_neg_prompt'];
        if (!this._boundRefreshStyles) this._boundRefreshStyles = this.refreshButtonStyles.bind(this);
        ids.forEach(id => {
            const el = gradioApp().getElementById(id); if (!el) return;
            const ta = el.querySelector('textarea'); if (!ta) return;
            if (ta._epsHandler) ta.removeEventListener('input', ta._epsHandler);
            ta._epsHandler = this._boundRefreshStyles; ta.addEventListener('input', ta._epsHandler);
        });
        this.updateVisualLayers();
    }

    refreshButtonStyles() {
        if (!this.visible && !this.editingMacro && !this.isFavEditing) return;
        const getVal = (id) => { const el = gradioApp().getElementById(id); if (!el) return ""; const ta = el.querySelector('textarea'); return ta ? ta.value : ""; };
        const pos = (getVal('txt2img_prompt') + " " + getVal('img2img_prompt')); const neg = (getVal('txt2img_neg_prompt') + " " + getVal('img2img_neg_prompt'));
        const c_pos = "#2563eb"; const c_neg = "#dc2626"; const c_bg = "var(--button-secondary-background-fill)";  
        const stripePattern = "repeating-linear-gradient(45deg, rgba(124, 58, 237, 0.9), rgba(124, 58, 237, 0.9) 8px, rgba(167, 139, 250, 0.9) 8px, rgba(167, 139, 250, 0.9) 16px)";

        this.allButtons.forEach(item => {
            const { btn, value, originalColor, displayTitle, rawTitle, isSystem } = item;
            if (!btn || !btn.isConnected || isSystem) return;

            const cleanVal = value.trim(); const macroLabel = `%%${rawTitle}%%`;
            const checkExists = (text, tag, label) => {
                const subTags = tag.split(',').map(s => s.trim()).filter(s => s);
                const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const reLabel = new RegExp(`(^|,|\\s)${escapedLabel}($|,|\\s)`, 'i');
                if (reLabel.test(text)) return true;
                return subTags.length > 0 && subTags.every(st => { const escaped = st.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(^|,|\\s)${escaped}($|,|\\s)`, 'i'); return re.test(text); });
            };

            const valInPos = checkExists(pos, cleanVal, "___DUMMY___"); const valInNeg = checkExists(neg, cleanVal, "___DUMMY___");
            const titInPos = checkExists(pos, "___DUMMY___", macroLabel); const titInNeg = checkExists(neg, "___DUMMY___", macroLabel);

            let leftColor = null; let rightColor = null;
            if (valInPos && valInNeg) leftColor = "stripe"; else if (valInPos) leftColor = c_pos; else if (valInNeg) leftColor = c_neg;
            if (titInPos && titInNeg) rightColor = "stripe"; else if (titInPos) rightColor = c_pos; else if (titInNeg) rightColor = c_neg;

            if (leftColor || rightColor) { btn.style.color = "white"; btn.style.textShadow = '0px 1px 2px rgba(0, 0, 0, 0.4)'; } 
            else { btn.style.color = "var(--button-secondary-text-color)"; btn.style.textShadow = 'none'; }

            if (leftColor === "stripe" && rightColor === "stripe") { btn.style.background = stripePattern; }
            else if (leftColor === "stripe") { btn.style.background = `linear-gradient(to left, ${rightColor || 'transparent'} 0%, transparent 100%), ${stripePattern}`; }
            else if (rightColor === "stripe") { btn.style.background = `linear-gradient(to right, ${leftColor || 'transparent'} 0%, transparent 100%), ${stripePattern}`; }
            else if (leftColor && rightColor) { btn.style.background = `linear-gradient(to right, ${leftColor} 0%, transparent 100%), linear-gradient(to left, ${rightColor} 0%, transparent 100%), ${c_bg}`; }
            else if (leftColor) { btn.style.background = `linear-gradient(to right, ${leftColor} 0%, transparent 100%), ${c_bg}`; }
            else if (rightColor) { btn.style.background = `linear-gradient(to left, ${rightColor} 0%, transparent 100%), ${c_bg}`; }
            else { EPSElementBuilder.applyColor(btn, originalColor); }

            const isFav = this.favorites.some(f => f.v === value);
            if (isFav) { btn.style.border = "2px solid #fbbf24"; btn.style.boxShadow = this.isFavEditing ? '0 0 0 2px rgba(251,191,36,0.45), 0 0 14px rgba(251,191,36,0.95)' : '0 0 0 1px rgba(251,191,36,0.35), 0 0 8px rgba(251,191,36,0.65)'; } 
            else { const styles = { 'primary': '1px solid transparent', 'secondary': '1px solid var(--button-secondary-border-color)' }; btn.style.border = styles[originalColor] || '1px solid transparent'; btn.style.boxShadow = 'none'; }
        });
        this.updateVisualLayers(); this.writeToCommunicationBox(); 
    }

    findTagDisplayName(tag) {
        const cleanTag = tag.trim().replace(/,+$/, '');
        for (const item of this.allButtons) { if (!item.isSystem && item.value.trim().replace(/,+$/, '') === cleanTag) return (item.displayTitle || item.rawTitle || item.value || cleanTag); }
        return cleanTag;
    }

    updateVisualLayers() {
        const getVal = (id) => { const el = gradioApp().getElementById(id); if (!el) return ''; const ta = el.querySelector('textarea'); return ta ? ta.value : ''; };
        const pos = getVal('txt2img_prompt') || getVal('img2img_prompt'); const neg = getVal('txt2img_neg_prompt') || getVal('img2img_neg_prompt');

        const registeredPhrases = this.allButtons.filter(b => !b.isSystem && b.value).map(b => {
                const pureVal = b.value.split('|')[0].trim().replace(/,+$/, ''); const subTags = pureVal.split(',').map(s => s.trim()).filter(s => s); return { button: b, pureVal, subTags };
            }).filter(x => x.subTags.length > 1).sort((a, b) => b.subTags.length - a.subTags.length);

        const parsePromptToChips = (promptText) => {
            if (!promptText) return []; const rawTags = promptText.split(',').map(t => t.trim()).filter(t => t);
            let chipInfos = rawTags.map(t => { let text = t; let color = null; if (t.includes('|')) { const parts = t.split('|'); text = parts[0].trim(); if (parts[1] && parts[1].trim().startsWith('#')) color = parts[1].trim(); } return { text, color, isMerged: false }; });

            for (const rp of registeredPhrases) {
                const len = rp.subTags.length;
                for (let i = 0; i <= chipInfos.length - len; i++) {
                    let hasMerged = false; for (let j = 0; j < len; j++) { if (chipInfos[i + j].isMerged) { hasMerged = true; break; } }
                    if (hasMerged) continue; let match = true;
                    for (let j = 0; j < len; j++) { if (chipInfos[i + j].text.toLowerCase() !== rp.subTags[j].toLowerCase()) { match = false; break; } }
                    if (match) {
                        const slice = chipInfos.slice(i, i + len); const foundColor = slice.find(s => s.color); let mergedColor = foundColor ? foundColor.color : null;
                        if (!mergedColor && rp.button.value && rp.button.value.includes('|')) { const p = rp.button.value.split('|'); if (p[1]) mergedColor = p[1].trim(); }
                        chipInfos.splice(i, len, { text: rp.pureVal, color: mergedColor, isMerged: true }); i--; 
                    }
                }
            }
            return chipInfos;
        };

        const posChips = parsePromptToChips(pos); const negChips = parsePromptToChips(neg);

        const buildLayerHtml = (type, chips, colorHex) => {
            return `
                <div style="display:flex; align-items:flex-start; gap:8px;">
                    <div style="font-size:0.75rem; font-weight:900; color:${colorHex}; min-width:36px; padding-top:3px;">${type}<br> (${chips.length})</div>
                    <div style="line-height:1.45; word-break:break-word; flex:1;">
                        ${chips.map(chip => {
                            const t = chip.text; const label = this.findTagDisplayName(t); const styles = VISUAL_LAYER_CONFIG.styles; let selectedStyle = styles.normal;
                            const matchedItem = this.allButtons.find(b => !b.isSystem && (b.value.split('|')[0].trim().replace(/,+$/, '') === t || `%%${b.rawTitle}%%` === t));
                            let displayLabel = matchedItem ? (matchedItem.displayTitle || matchedItem.rawTitle || matchedItem.value.split('|')[0].trim()) : label;
                            const matchedRule = VISUAL_LAYER_CONFIG.rules.find(r => r.match(t, displayLabel)); if (matchedRule) selectedStyle = styles[matchedRule.style];
                            if (displayLabel.includes('|')) displayLabel = displayLabel.split('|')[0].trim();
                            let extractedColor = chip.color; if (!extractedColor && matchedItem && matchedItem.value && matchedItem.value.includes('|')) { const parts = matchedItem.value.split('|'); if (parts[1]) extractedColor = parts[1].trim(); }
                            let safeLabel = displayLabel.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                            if (/^[◇◉★]/.test(safeLabel)) {
                                let markChar = safeLabel.charAt(0); let markColor = 'inherit';
                                if (markChar === '★') markColor = '#facc15'; else if (markChar === '◉') { if (matchedItem && matchedItem.rawTitle) { const match = matchedItem.rawTitle.match(/\[([A-Z]+)\]/); if (match && IMAGE_BADGE_MAP[match[1]]) markColor = IMAGE_BADGE_MAP[match[1]].color; else markColor = '#3b82f6'; } else markColor = '#3b82f6'; }
                                safeLabel = safeLabel.replace(/^[◇◉★]\s*/, `<span style="color:${markColor}; font-weight:900; margin-right:4px;">${markChar} </span>`);
                            }
                            let swatchHtml = ''; if (extractedColor) swatchHtml = `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${extractedColor}; border:1px solid rgba(255,255,255,0.4); margin-right:5px; box-shadow:0 1px 3px rgba(0,0,0,0.5); flex-shrink:0;"></span>`;
                            const chipStyle = 'background:' + selectedStyle.bg + '; border:1px solid ' + selectedStyle.border + '; color:var(--body-text-color);';
                            return `<span style="display:inline-flex; align-items:center; margin:2px; padding:2px 8px; border-radius:999px; ${chipStyle} font-size:0.78rem;">${swatchHtml}${safeLabel}</span>`;
                        }).join('')}
                    </div>
                </div>`;
        };

        const posLayer = document.getElementById('eps-visual-pos'); if (posLayer) posLayer.innerHTML = buildLayerHtml('POS', posChips, '#60a5fa');
        const negLayer = document.getElementById('eps-visual-neg'); if (negLayer) negLayer.innerHTML = buildLayerHtml('NEG', negChips, '#f87171');
    }

    render() {
        const container = document.createElement('div'); container.id = this.AREA_ID; container.style.display = 'none'; container.style.marginTop = '10px'; container.style.border = '1px solid var(--block-border-color)'; container.style.backgroundColor = 'var(--background-fill-primary)'; container.style.padding = '10px'; container.style.borderRadius = '8px';
        const flexWrapper = document.createElement('div'); flexWrapper.style.display = 'flex'; flexWrapper.style.gap = '15px'; flexWrapper.style.width = '100%';
        const menuCol = document.createElement('div'); menuCol.style.flex = '4'; menuCol.style.display = 'flex'; menuCol.style.flexDirection = 'column'; menuCol.style.gap = '8px'; menuCol.style.minWidth = '0';
        const row1 = document.createElement('div'); row1.style.width = '100%'; row1.style.display = 'flex'; row1.style.gap = '6px'; row1.style.alignItems = 'center';

        const select = document.createElement('select'); select.id = this.SELECT_ID; select.classList.add('gr-box', 'gr-input'); select.style.flex = '7'; select.style.minWidth = '0';
        const negToggleBtn = EPSElementBuilder.baseButton('ネガティブへ流す', { color: 'secondary' }); negToggleBtn.style.flex = '3'; negToggleBtn.style.whiteSpace = 'nowrap'; negToggleBtn.style.overflow = 'hidden'; this.allButtons.push({ btn: negToggleBtn, isSystem: true }); 
        negToggleBtn.onclick = (e) => { e.preventDefault(); this.isNegMode = !this.isNegMode; updateToggleStyle(); this.refreshButtonStyles(); };

        const updateToggleStyle = () => { if (this.isNegMode) { EPSElementBuilder.applyColor(negToggleBtn, 'neg-active'); negToggleBtn.textContent = 'ネガティブへ流し中'; } else { EPSElementBuilder.applyColor(negToggleBtn, 'secondary'); negToggleBtn.textContent = 'ネガティブへ流す'; } }; updateToggleStyle();

        const posWrap = document.createElement('div'); posWrap.style.width = '120px'; posWrap.style.flexShrink = '0';
        const visualizePosBtn = EPSElementBuilder.baseButton('POS可視化 On', { color: 'secondary' }); visualizePosBtn.style.width = '100%'; visualizePosBtn.style.height = '32px'; visualizePosBtn.style.background = 'rgba(37,99,235,0.18)'; visualizePosBtn.style.border = '1px solid rgba(96,165,250,0.5)'; posWrap.appendChild(visualizePosBtn);

        const negWrap = document.createElement('div'); negWrap.style.width = '120px'; posWrap.style.flexShrink = '0';
        const visualizeNegBtn = EPSElementBuilder.baseButton('NEG可視化 On', { color: 'secondary' }); visualizeNegBtn.style.width = '100%'; visualizeNegBtn.style.height = '32px'; visualizeNegBtn.style.background = 'rgba(220,38,38,0.18)'; visualizeNegBtn.style.border = '1px solid rgba(248,113,113,0.5)'; negWrap.appendChild(visualizeNegBtn);

        this.visualizePosEnabled = false; this.visualizeNegEnabled = false;
        visualizePosBtn.onclick = () => { this.visualizePosEnabled = !this.visualizePosEnabled; visualizePosBtn.textContent = this.visualizePosEnabled ? 'POS 可視化 Off' : 'POS 可視化 On'; const posLayer = document.getElementById('eps-visual-pos'); if (posLayer) posLayer.style.display = this.visualizePosEnabled ? 'block' : 'none'; };
        visualizeNegBtn.onclick = () => { this.visualizeNegEnabled = !this.visualizeNegEnabled; visualizeNegBtn.textContent = this.visualizeNegEnabled ? 'NEG 可視化 Off' : 'NEG 可視化 On'; const negLayer = document.getElementById('eps-visual-neg'); if (negLayer) negLayer.style.display = this.visualizeNegEnabled ? 'block' : 'none'; };

        row1.append(select, negToggleBtn, posWrap);

        const visualPos = document.createElement('div'); visualPos.id = 'eps-visual-pos'; visualPos.style.width = '100%'; visualPos.style.marginBottom = '8px'; visualPos.style.display = 'none'; visualPos.style.padding = '8px'; visualPos.style.border = '1px solid var(--block-border-color)'; visualPos.style.borderRadius = '6px'; visualPos.style.background = 'rgba(37,99,235,0.08)';
        const visualNeg = document.createElement('div'); visualNeg.id = 'eps-visual-neg'; visualNeg.style.width = '100%'; visualNeg.style.marginBottom = '12px'; visualNeg.style.display = 'none'; visualNeg.style.padding = '8px'; visualNeg.style.border = '1px solid var(--block-border-color)'; visualNeg.style.borderRadius = '6px'; visualNeg.style.background = 'rgba(220,38,38,0.08)';

        const row2 = document.createElement('div'); row2.style.width = '100%'; row2.style.display = 'flex'; row2.style.gap = '6px'; row2.style.alignItems = 'center';

        const searchWrap = document.createElement('div'); searchWrap.style.display = 'flex'; searchWrap.style.flex = '1'; searchWrap.style.position = 'relative'; searchWrap.style.alignItems = 'center';
        const searchInput = document.createElement('input'); searchInput.type = 'text'; searchInput.placeholder = '🔍 検索...'; searchInput.id = 'eps-v14-search-input'; searchInput.classList.add('gr-box', 'gr-input'); searchInput.style.width = '100%'; searchInput.style.paddingRight = '24px'; 
        searchInput.oninput = (e) => { this.handleSearch(e.target.value); if(e.target.value === "") { const fs = document.getElementById('eps-flag-select'); if(fs) fs.value = ""; } };
        
        const clearBtn = document.createElement('span'); clearBtn.textContent = '[✖]'; clearBtn.style.position = 'absolute'; clearBtn.style.right = '8px'; clearBtn.style.cursor = 'pointer'; clearBtn.style.color = 'var(--body-text-color-subdued)'; clearBtn.style.fontWeight = 'bold';
        clearBtn.onclick = () => { searchInput.value = ''; const fs = document.getElementById('eps-flag-select'); if(fs) fs.value = ''; this.handleSearch(''); };
        searchWrap.append(searchInput, clearBtn);

        this.searchIncludeValue = false;
        const cbBtn = EPSElementBuilder.baseButton('☐ +Prompt', { color: 'secondary' }); cbBtn.style.fontSize = '0.75rem'; cbBtn.style.padding = '4px 8px'; cbBtn.style.flexShrink = '0';
        cbBtn.onclick = () => { 
            this.searchIncludeValue = !this.searchIncludeValue; 
            cbBtn.textContent = this.searchIncludeValue ? '☑ +Prompt' : '☐ +Prompt'; 
            EPSElementBuilder.applyColor(cbBtn, this.searchIncludeValue ? 'radio-active' : 'secondary'); 
            this.handleSearch(searchInput.value); 
        };

        const flagSelect = document.createElement('select'); flagSelect.id = 'eps-flag-select'; flagSelect.classList.add('gr-box', 'gr-input'); 
        flagSelect.style.width = '42px'; flagSelect.style.flexShrink = '0'; flagSelect.style.padding = '0'; flagSelect.style.cursor = 'pointer'; flagSelect.style.textAlign = 'center'; flagSelect.style.appearance = 'none'; 
        flagSelect.style.border = '1px solid var(--button-border-color, #444)'; flagSelect.style.borderRadius = '4px'; flagSelect.style.background = 'var(--button-secondary-background-fill, #2b2b2b)';
        flagSelect.style.color = 'var(--body-text-color)'; flagSelect.style.WebkitAppearance = 'none'; flagSelect.style.MozAppearance = 'none'; flagSelect.style.backgroundImage = 'none';
        let flagOpts = `<option value="">🏁</option>`; Object.keys(TAG_PREFIX_MAP).forEach(k => flagOpts += `<option value="${k}">${k}</option>`); flagSelect.innerHTML = flagOpts;
        flagSelect.onchange = (e) => { const v = e.target.value; searchInput.value = v; this.handleSearch(v); };

        row2.append(searchWrap, cbBtn, flagSelect, negWrap);

        const historyRow = document.createElement('div'); historyRow.id = 'eps-v14-history-row'; historyRow.style.display = 'flex'; historyRow.style.gap = '4px'; historyRow.style.flexWrap = 'wrap';
        const favRow = document.createElement('div'); favRow.id = 'eps-v14-fav-row'; favRow.style.display = 'flex'; favRow.style.gap = '4px'; favRow.style.flexWrap = 'wrap'; favRow.style.alignItems = 'center';
        const macroRow = document.createElement('div'); macroRow.id = 'eps-v14-macro-row'; macroRow.style.display = 'flex'; macroRow.style.flexDirection = 'column'; macroRow.style.gap = '4px';
        
        const previewArea = document.createElement('div'); previewArea.id = this.PREVIEW_ID; previewArea.style.width = '100%'; previewArea.style.height = '380px'; previewArea.style.marginTop = '10px'; previewArea.style.border = '1px solid var(--block-border-color)'; previewArea.style.borderRadius = '8px'; previewArea.style.display = 'flex'; previewArea.style.backgroundColor = 'var(--input-background-fill)'; previewArea.style.padding = '10px'; previewArea.style.overflow = 'hidden';
        this.setEmptyPreview(previewArea);

        menuCol.append(row1, row2, historyRow, favRow, macroRow, previewArea);

        const contentCol = document.createElement('div'); contentCol.style.flex = '6'; contentCol.style.minHeight = '400px'; contentCol.style.maxHeight = '85vh'; contentCol.style.overflowY = 'auto'; contentCol.style.paddingLeft = '5px';
        const searchResDiv = document.createElement('div'); searchResDiv.id = this.SEARCH_ID; searchResDiv.style.display = 'none'; searchResDiv.style.flexWrap = 'wrap'; searchResDiv.style.padding = '10px'; searchResDiv.style.marginBottom = '10px'; searchResDiv.style.border = '2px solid #ffa500'; searchResDiv.style.borderRadius = '8px'; searchResDiv.style.gap = '4px';

        const contentArea = this.renderContent();
        select.onchange = (e) => {
            const selected = e.target.value; this.lastSelected = selected; const contentArea = document.getElementById(this.CONTENT_ID); if (!contentArea) return;
            Array.from(contentArea.childNodes).forEach(n => { if (!n.id) return; n.style.display = (selected && n.id === `eps-c-${selected}`) ? 'flex' : 'none'; });
        };

        contentCol.append(searchResDiv, contentArea); flexWrapper.append(menuCol, contentCol);
        container.append(visualPos, visualNeg, flexWrapper);

        return container;
    }

    setEmptyPreview(el) { el.innerHTML = `<div style="display:flex; width:100%; height:100%; align-items: stretch; justify-content: center;"><div style="display: flex; flex-direction: column; align-items: center; justify-content: center; color:var(--body-text-color-subdued);"><div style="font-size:0.9rem; opacity:0.6; font-weight:700;">No Selection</div></div></div>`; }

    handleSearch(query) {
        this.allButtons = this.allButtons.filter(item => !item.isSearchResult);
        const sRes = document.getElementById(this.SEARCH_ID); const cArea = document.getElementById(this.CONTENT_ID);
        if (!query.trim()) { sRes.style.display = 'none'; cArea.style.display = 'block'; return; }
        sRes.style.display = 'flex'; cArea.style.display = 'none'; sRes.innerHTML = '';

        const includeValue = this.searchIncludeValue; 
        const cleanQuery = query.trim();
        const isFlagSearch = /^\[[A-Z0-9]+\]$/i.test(cleanQuery); 
        const terms = cleanQuery.toLowerCase().split(/\s+/).filter(t => t); const results = [];
        
        this.allButtons.forEach(item => {
            if (item.isSystem) return; if (item.value && item.value.startsWith('@') && item.value.endsWith('@')) return;
            
            if (isFlagSearch) {
                if (item.rawTitle && item.rawTitle.includes(cleanQuery.toUpperCase())) results.push(item);
                return;
            }

            let buttonName = item.cleanDisplayTitle || item.rawTitle || item.displayTitle || ''; buttonName = buttonName.replace(/^[◉★◇◆👤❤️👕💎]\s*/, '').replace(/\s*\(\d+\)\s*$/, '').toLowerCase().trim();
            let tagValue = (item.value || '').toLowerCase().trim().replace(/%%[^%]+%%/g, ''); 

            if (includeValue) { if (terms.every(term => buttonName.includes(term) || tagValue.includes(term))) results.push(item); } 
            else { if (terms.every(term => buttonName.includes(term))) results.push(item); }
        });

        if (results.length > 0) {
            const fragment = document.createDocumentFragment();
            
            if (isFlagSearch) {
                const resultBtn = EPSElementBuilder.baseButton(`🎯 ${query} 全${results.length}件からランダム抽出`, { color: 'macro-rm' }); 
                resultBtn.style.fontWeight = '900'; resultBtn.style.fontSize = '1.05rem'; resultBtn.style.padding = '8px'; resultBtn.style.marginBottom = '4px'; resultBtn.style.width = '100%';
                resultBtn.onclick = () => { this.toggleTag(`%%SEARCH:${query}%%`, this.isNegMode); this.updateHistory(query); };
                fragment.appendChild(resultBtn);
                
                const note = document.createElement('div'); note.style.fontSize = '0.7rem'; note.style.color = 'var(--body-text-color-subdued)'; note.style.textAlign = 'center'; note.style.width = '100%';
                note.textContent = '※ 個別表示は省略。生成時に全件から抽選されます。';
                fragment.appendChild(note);
            } else {
                const resultBtn = EPSElementBuilder.baseButton(`検索結果 (${results.length}件)`, { color: 'primary' }); resultBtn.style.fontWeight = '900'; resultBtn.style.marginBottom = '6px'; resultBtn.style.width = '100%';
                resultBtn.onclick = () => { this.toggleTag(`%%SEARCH:${query}%%`, this.isNegMode); this.updateHistory(query); };
                fragment.appendChild(resultBtn);

                results.slice(0, 100).forEach(item => {
                    let extMark = ''; let extColor = '';
                    if (item.btn) { const mNode = item.btn.querySelector('.eps-mark-node'); if (mNode) { extMark = mNode.textContent; extColor = mNode.style.color; } }
                    const btn = this.renderTagButton(item.rawTitle, item.value, item.originalColor, item.category, true, extMark, extColor); fragment.appendChild(btn);
                });
            }
            
            // 🌟 修正：キャッシュの記録も安全に合体させたラベルにする
        sRes.appendChild(fragment); 
        this.searchCache[query] = results.map(r => {
            const cleanName = (r.pureTitle || r.rawTitle).replace(/[★◇◆◉]/g, '').trim();
            const label = (r.prefixIcon ? r.prefixIcon + ' ' : '') + cleanName;
            return { t: label, v: r.value };
        });
        } else { sRes.innerHTML = '<span style="color:var(--body-text-color-subdued)">一致するタグがありません</span>'; }
        this.refreshButtonStyles();
    }

    updateHistory(query) {
        if (!query || query.length < 2) return; this.history = [query, ...this.history.filter(h => h !== query)].slice(0, this.HISTORY_COUNT);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.history)); this.renderHistoryAndMacros();
    }

    renderHistoryAndMacros() {
        const hDiv = document.getElementById('eps-v14-history-row');
        if (hDiv) {
            hDiv.innerHTML = `<span style="color:var(--body-text-color-subdued); padding:4px;">履歴:</span>`;
            const clearBtn = EPSElementBuilder.baseButton('X', { color:'secondary' }); clearBtn.style.fontSize = '0.75rem'; clearBtn.style.padding = '2px 8px'; clearBtn.onclick = () => { this.history = []; localStorage.removeItem(this.STORAGE_KEY); this.renderHistoryAndMacros(); }; hDiv.appendChild(clearBtn);
            this.history.forEach(q => {
                const btn = EPSElementBuilder.baseButton(q, { color: 'secondary' }); btn.style.fontSize = '0.75rem'; btn.style.padding = '2px 8px';
                btn.onclick = () => { this.toggleTag(`%%SEARCH:${q}%%`, this.isNegMode); const sInput = document.getElementById('eps-v14-search-input'); if (sInput) { sInput.value = q; this.handleSearch(q); } }; hDiv.appendChild(btn);
            });
        }

        const fDiv = document.getElementById('eps-v14-fav-row');
        if (fDiv) {
            fDiv.innerHTML = '<span style="color:var(--body-text-color-subdued); padding:4px;">Fav:</span>';
            const editBtn = EPSElementBuilder.baseButton(this.isFavEditing ? '終了' : '編集', { color: this.isFavEditing ? 'fav-edit' : 'secondary' }); editBtn.style.fontSize = '0.75rem'; editBtn.style.padding = '2px 8px'; this.allButtons.push({ btn: editBtn, isSystem: true }); 
            editBtn.onclick = (e) => { e.preventDefault(); this.isFavEditing = !this.isFavEditing; this.renderHistoryAndMacros(); this.refreshButtonStyles(); }; fDiv.appendChild(editBtn);
            this.favorites.forEach(fav => {
                const btn = EPSElementBuilder.baseButton(fav.t, { color: 'secondary' }); btn.style.fontSize = '0.75rem'; btn.style.padding = '2px 8px';
                btn.onclick = (e) => { e.preventDefault(); if (this.isFavEditing) this.toggleFavorite(fav.t, fav.v); else this.toggleTag(fav.v, this.isNegMode); };
                btn.oncontextmenu = (e) => { e.preventDefault(); if (this.isFavEditing) return false; let pureTitle = fav.t; Object.entries(TAG_PREFIX_MAP).forEach(([prefix, info]) => { pureTitle = pureTitle.replace(prefix, '').replace(info.icon, '').trim(); }); pureTitle = pureTitle.replace(/\s*\(\d+\)\s*$/, '').trim(); this.toggleTag(`%%${pureTitle}%%`, this.isNegMode); return false; };
                this.allButtons.push({ btn, value: fav.v, originalColor: 'secondary', displayTitle: fav.t, rawTitle: fav.t, category: 'Fav' }); fDiv.appendChild(btn);
            });
        }

        const mDiv = document.getElementById('eps-v14-macro-row');
        if (mDiv) {
            mDiv.innerHTML = '';
            const renderGroup = (prefix, colorClass, count, labelTxt) => {
                const row = document.createElement('div'); row.style.display = 'flex'; row.style.flexWrap = 'wrap'; row.style.gap = '2px'; row.style.alignItems = 'center';
                const label = document.createElement('span'); label.style.color = 'var(--body-text-color-subdued)'; label.style.padding = '4px'; label.style.fontSize = '0.75rem'; label.textContent = labelTxt; row.appendChild(label);
                for (let i = 1; i <= count; i++) {
                    const mid = `${prefix}${i}`; const isRegistered = !!this.macros[mid]; const isEditing = this.editingMacro === mid; let color = isRegistered ? colorClass : 'macro-empty'; if (isEditing) color = 'macro-edit';
                    const btn = EPSElementBuilder.baseButton(mid, { color }); btn.style.fontSize = '0.7rem'; btn.style.padding = '2px 4px';
                    btn.onclick = () => { if (isEditing) this.saveMacro(mid, this.editingContent); else if (isRegistered) this.toggleTag(`%%${mid}%%`, this.isNegMode); else this.startEditMacro(mid); };
                    btn.oncontextmenu = (e) => { e.preventDefault(); this.startEditMacro(mid); }; row.appendChild(btn);
                }
                mDiv.appendChild(row);
            };
            renderGroup('NM', 'macro-nm', this.NM_COUNT, 'NM:'); renderGroup('RM', 'macro-rm', this.RM_COUNT, 'RM:');

            if (this.editingMacro) {
                const editorWrap = document.createElement('div'); editorWrap.style.marginTop = '5px'; editorWrap.style.display = 'flex'; editorWrap.style.flexDirection = 'column'; editorWrap.style.gap = '4px';
                const input = document.createElement('input'); input.id = 'eps-macro-edit-input'; input.type = 'text'; input.value = this.editingContent; input.placeholder = `${this.editingMacro}の内容を入力...`; input.classList.add('gr-box', 'gr-input'); input.style.width = '100%'; input.oninput = (e) => { this.editingContent = e.target.value; };
                const btnRow = document.createElement('div'); btnRow.style.display = 'flex'; btnRow.style.gap = '4px';
                const deleteBtn = EPSElementBuilder.baseButton('消去', { color: 'secondary' }); deleteBtn.style.background = '#ef4444'; deleteBtn.style.color = 'white'; deleteBtn.onclick = () => { input.value = ""; this.editingContent = ""; input.focus(); };
                const saveBtn = EPSElementBuilder.baseButton('保存', { color: 'macro-nm' }); saveBtn.onclick = () => { this.saveMacro(this.editingMacro, this.editingContent); };
                btnRow.append(deleteBtn, saveBtn); editorWrap.append(input, btnRow); mDiv.appendChild(editorWrap);
            }
        }
    }

    startEditMacro(mid) { this.editingMacro = mid; this.editingContent = this.macros[mid] || ""; this.renderHistoryAndMacros(); this.refreshButtonStyles(); }

    saveMacro(mid, content) { if (!content.trim()) delete this.macros[mid]; else this.macros[mid] = content.trim(); localStorage.setItem(this.MACRO_STORAGE_KEY, JSON.stringify(this.macros)); this.editingMacro = null; this.renderHistoryAndMacros(); this.refreshButtonStyles(); this.writeToCommunicationBox(); }

    toggleFavorite(title, value) { const idx = this.favorites.findIndex(f => f.v === value); if (idx >= 0) this.favorites.splice(idx, 1); else this.favorites.push({ t: title, v: value }); localStorage.setItem(this.FAV_STORAGE_KEY, JSON.stringify(this.favorites)); this.renderHistoryAndMacros(); this.refreshButtonStyles(); }

    showPreview(displayTitle, value, category, rawTitle = "") {
        const previewArea = document.getElementById(this.PREVIEW_ID); if (!previewArea) return;
        const baseFilePath = this.tagFilePaths[category]; let localCache = {}; try { const saved = localStorage.getItem('eps_image_status_cache'); if (saved) localCache = JSON.parse(saved); } catch (e) { localCache = {}; }

        let candidates = []; let cleanName = rawTitle || displayTitle;
        Object.keys(TAG_PREFIX_MAP).forEach(p => cleanName = cleanName.replace(p, '')); Object.values(TAG_PREFIX_MAP).forEach(v => cleanName = cleanName.replace(v.icon, '')); cleanName = cleanName.trim();

        if (value && /\|\s*#/.test(value)) candidates = [];
        else {
            const hasTagPrefix = Object.keys(TAG_PREFIX_MAP).some(prefix => rawTitle.includes(prefix)); const cacheStatus = localCache[rawTitle] || 'none';
            if (hasTagPrefix) { candidates.push(rawTitle.trim()); if (cleanName && !candidates.includes(cleanName)) candidates.push(cleanName); if (cacheStatus === 'none') candidates = []; else if (cacheStatus === 'G') candidates = candidates.filter(name => name === cleanName); else candidates = [rawTitle.trim()]; } 
            else { if (cacheStatus === 'none') candidates = []; else if (['C', 'S', 'O', 'E'].includes(cacheStatus)) candidates = [`${cleanName} [${cacheStatus}]`]; else if (cacheStatus === 'G' || cacheStatus === 'generic') candidates = [cleanName]; }
        }

        let imgHtml = "";
        if (baseFilePath) {
            let badgeHtml = ""; const folderPath = baseFilePath.substring(0, baseFilePath.lastIndexOf('/')); const cb = `cb=${Date.now()}`; const badgeTypes = [];
            const hasSpecific = candidates.some(name => /\[[A-Z]+\]/.test(name));
            if (hasSpecific) { const found = new Set(); candidates.forEach(name => { const matches = [...name.matchAll(/\[([A-Z]+)\]/g)]; matches.forEach(m => { m[1].split('').forEach(t => { if (IMAGE_BADGE_MAP[t]) found.add(t); }); }); }); found.forEach(t => { badgeTypes.push(IMAGE_BADGE_MAP[t]); }); } 
            else { badgeTypes.push(IMAGE_BADGE_MAP['G']); }

            badgeHtml = `<div style="position:absolute; top:8px; left:8px; display:flex; gap:6px; z-index:200; flex-wrap:wrap;">${badgeTypes.map(b => `<div style="background:${b.color}; color:white; font-size:0.72rem; font-weight:900; padding:2px 8px; border-radius:999px; box-shadow:0 2px 6px rgba(0,0,0,0.35);">${b.label}</div>`).join('')}</div>`;
            const generateImgTags = () => { if (candidates.length === 0) return ''; let tags = ''; candidates.forEach((name, i) => { const clean = name.trim(); if (!clean) return; const url = `file=${folderPath}/${clean}.png?${cb}`; tags += `<img src="${url}" onload="if (this.naturalWidth > 0) window.epsHandlePreviewLoad(this, '${clean}', ${i});" onerror="this.onerror=null; this.style.display='none';" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:contain; z-index:${100 - i}; opacity:0; transition:opacity 0.2s;">`; }); return tags; };
            imgHtml = `<div style="flex: 0 0 65%; height: 100%; display: flex; align-items: center; justify-content: center; background: #e0e0e0; border-radius: 4px; overflow: hidden; position: relative;">${generateImgTags()}<div class="eps-no-image-placeholder" style="position:absolute; top:0; left:0; z-index:0; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; color:#999;"><div style="font-size:3.5rem; opacity:0.4;">🚫</div><div style="font-size:0.8rem; font-weight:900; opacity:0.6; text-align:center; padding:0 10px;">IMAGE NOT FOUND<br><span style="font-size:0.6rem; font-weight:normal;">Tried: ${cleanName} / ${candidates[0]}</span></div></div></div>`;
        }

        const cleanValDisplay = value.replace(/^[\s,]+|[\s,]+$/g, '').trim(); const evaporatedDisplay = cleanValDisplay.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); const highlightedDisplay = evaporatedDisplay.replace(/(&lt;lora:.*?:.*?&gt;)/g, '<span style="color:#7a19b3;font-weight:700;">$1</span>');
        
        // 🌟 修正箇所：タイトル下線（横棒）の直下に、小さめの文字で「📁 ファイル名.yml」が入るようにHTML構造を調整
        const textContent = `<div style="flex: 0 0 35%; min-width: 0; display: flex; flex-direction: column; justify-content: flex-start; gap: 10px; padding-left: 15px; overflow-y: auto;"><div style="font-weight:900; color:#3b82f6; font-size:1.15rem; line-height:1.2; word-break:break-all; border-bottom: 2px solid rgba(59, 130, 246, 0.2); padding-bottom: 4px;">${displayTitle}</div><div style="font-size:0.75rem; color:var(--body-text-color-subdued); opacity:0.65; margin-top:-6px; font-weight:bold; display:flex; align-items:center; gap:4px;">📁 ${category}</div><div style="font-family:monospace; color:var(--body-text-color); font-size:0.95rem; background:rgba(0,0,0,0.04); padding:10px; border-radius:4px; word-break:break-all; border:1px solid var(--block-border-color); line-height:1.4;">${highlightedDisplay}</div></div>`;
        
        previewArea.innerHTML = `<div style="display:flex; width:100%; height:100%; align-items: stretch;">${imgHtml}${textContent}</div>`;
    }

    clearPreview() { const previewArea = document.getElementById(this.PREVIEW_ID); if (previewArea) this.setEmptyPreview(previewArea); }

    renderTagButton(title, value, color, category = '', isSearchResult = false, extMark = '', extColor = '') {
        const rawTitle = title.replace(/\s*\(\d+\)\s*$/, ''); let displayTitle = title; let prefixIcon = ''; let pureTitle = rawTitle;
        Object.entries(TAG_PREFIX_MAP).forEach(([prefix, info]) => { if (displayTitle.includes(prefix)) { prefixIcon = info.icon; pureTitle = displayTitle.replace(prefix, '').replace(/\s*\(\d+\)\s*$/, '').trim(); displayTitle = info.icon + displayTitle.replace(prefix, '').trim(); } });

        const cleanName = pureTitle.replace(/[★◇◆◉]/g, '').trim();
        const historyLabel = (prefixIcon ? prefixIcon + ' ' : '') + cleanName;

        const isRealPromptButton = value && !value.includes('@'); const hasColorBox = value && value.includes('|');
        const btn = EPSElementBuilder.baseButton('', { color }); btn.style.display = 'inline-flex'; btn.style.alignItems = 'center'; btn.style.gap = '4px';

        if (hasColorBox) { const parts = value.split('|'); const hex = parts[1]?.trim(); if (hex) { const colorBox = document.createElement('span'); colorBox.style.width = '14px'; colorBox.style.height = '14px'; colorBox.style.borderRadius = '3px'; colorBox.style.background = hex; colorBox.style.border = '1px solid rgba(0,0,0,0.35)'; colorBox.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.6)'; colorBox.style.flexShrink = '0'; btn.appendChild(colorBox); } }
        
        // 🌟 修正1：検索結果でマークが存在しない場合は◇を追加しないように制御
        if (isRealPromptButton && !hasColorBox) { 
            if (!isSearchResult || (isSearchResult && extMark)) {
                const markNode = document.createElement('span'); markNode.className = 'eps-mark-node'; markNode.style.fontWeight = '900'; markNode.style.flexShrink = '0'; 
                markNode.textContent = isSearchResult ? extMark : '◇'; 
                if (isSearchResult && extColor) markNode.style.color = extColor; 
                btn.appendChild(markNode); 
            }
        }
        
        if (prefixIcon) { const iconNode = document.createElement('span'); iconNode.className = 'eps-icon-node'; iconNode.style.flexShrink = '0'; iconNode.textContent = prefixIcon; btn.appendChild(iconNode); }

        const textToDisplay = prefixIcon ? displayTitle.substring(prefixIcon.length).trim() : displayTitle; const textNode = document.createElement('span'); textNode.className = 'eps-text-node'; textNode.textContent = textToDisplay; btn.appendChild(textNode);

        this.allButtons.push({ btn, value, originalColor: color, displayTitle: (isSearchResult && extMark) ? (extMark + ' ' + displayTitle) : displayTitle, cleanDisplayTitle: displayTitle, prefixIcon, pureTitle, category, rawTitle, isPrompt: isRealPromptButton && !hasColorBox, isSearchResult });

        if (!value.startsWith('@')) { btn.addEventListener('mouseenter', () => this.showPreview(displayTitle, value, category, rawTitle)); btn.addEventListener('mouseleave', () => this.clearPreview()); }
        
        btn.onclick = (e) => { 
            e.preventDefault(); const cleanVal = value.trim();
            if (this.isFavEditing) { this.toggleFavorite(displayTitle, cleanVal); return; }
            if (this.editingMacro) { 
                // 🌟 修正2：マクロの左クリック時にトグル＆カーソル追従
                const isRM = this.editingMacro.startsWith('RM'); const delim = isRM ? ' ;; ' : ', '; 
                let formattedVal = (isRM && cleanVal.includes(',')) ? `"${cleanVal}"` : cleanVal; 
                let currentParts = this.editingContent.split(delim).map(s => s.trim()).filter(s => s);
                if (currentParts.includes(formattedVal)) currentParts = currentParts.filter(p => p !== formattedVal);
                else currentParts.push(formattedVal);
                this.editingContent = currentParts.join(delim); 
                this.renderHistoryAndMacros(); this.refreshButtonStyles(); 
                setTimeout(() => { const inp = document.getElementById('eps-macro-edit-input'); if (inp) { inp.focus(); inp.selectionStart = inp.value.length; inp.selectionEnd = inp.value.length; inp.scrollLeft = inp.scrollWidth; } }, 10);
                return; 
            }
            this.toggleTag(value, this.isNegMode);
        };
        
        btn.oncontextmenu = (e) => {
            e.preventDefault(); const baseName = rawTitle ? rawTitle : displayTitle.replace(/\s*\(\d+\)\s*$/, ''); const macroLabel = `%%${baseName}%%`;
            if (this.isFavEditing) return false;
            if (this.editingMacro) { 
                // 🌟 修正3：マクロの右クリック（ラベル）時にもトグル＆カーソル追従
                const isRM = this.editingMacro.startsWith('RM'); const delim = isRM ? ' ;; ' : ', '; 
                let currentParts = this.editingContent.split(delim).map(s => s.trim()).filter(s => s);
                if (currentParts.includes(macroLabel)) currentParts = currentParts.filter(p => p !== macroLabel);
                else currentParts.push(macroLabel);
                this.editingContent = currentParts.join(delim); 
                this.renderHistoryAndMacros(); this.refreshButtonStyles(); 
                setTimeout(() => { const inp = document.getElementById('eps-macro-edit-input'); if (inp) { inp.focus(); inp.selectionStart = inp.value.length; inp.selectionEnd = inp.value.length; inp.scrollLeft = inp.scrollWidth; } }, 10);
                return false; 
            }
            this.toggleTag(macroLabel, this.isNegMode); 
            return false;
        };
        
        return btn;
    }

    writeToCommunicationBox() {
        try {
            const commBox = gradioApp().getElementById('eps-communication-box')?.querySelector('textarea'); if (!commBox) return;
            let activeLabelMap = { ...(this.macroLabelMap || {}) };
            if (Array.isArray(this.allButtons)) { this.allButtons.forEach(b => { if (b && b.rawTitle && b.value) { activeLabelMap[b.rawTitle.trim()] = b.value.trim(); } }); }
            
            // 🌟 追加：プロンプト内に「まだ検索してないSEARCHタグ」があれば、裏で自動検索してキャッシュを復元する
            const getVal = (id) => { const el = gradioApp().getElementById(id); return el ? (el.querySelector('textarea')?.value || "") : ""; };
            const fullText = getVal('txt2img_prompt') + " " + getVal('img2img_prompt') + " " + getVal('txt2img_neg_prompt') + " " + getVal('img2img_neg_prompt');
            const searchMatches = fullText.match(/%%SEARCH:([^%]+)%%/g);
            if (searchMatches) {
                searchMatches.forEach(match => {
                    const query = match.replace(/^%%SEARCH:/, '').replace(/%%$/, '');
                    if (!this.searchCache[query]) { 
                        const cleanQuery = query.trim(); const isFlagSearch = /^\[[A-Z0-9]+\]$/i.test(cleanQuery); const terms = cleanQuery.toLowerCase().split(/\s+/).filter(t => t); const results = [];
                        this.allButtons.forEach(item => {
                            if (item.isSystem || (item.value && item.value.startsWith('@') && item.value.endsWith('@'))) return;
                            if (isFlagSearch) { if (item.rawTitle && item.rawTitle.includes(cleanQuery.toUpperCase())) results.push(item); return; }
                            let btnName = (item.cleanDisplayTitle || item.rawTitle || item.displayTitle || '').replace(/^[◉★◇◆👤❤️👕💎]\s*/, '').replace(/\s*\(\d+\)\s*$/, '').toLowerCase().trim();
                            let tagVal = (item.value || '').toLowerCase().trim().replace(/%%[^%]+%%/g, '');
                            if (this.searchIncludeValue) { if (terms.every(term => btnName.includes(term) || tagVal.includes(term))) results.push(item); } 
                            else { if (terms.every(term => btnName.includes(term))) results.push(item); }
                        });
                        this.searchCache[query] = results.map(r => {
                            const cleanName = (r.pureTitle || r.rawTitle).replace(/[★◇◆◉]/g, '').trim();
                            const label = (r.prefixIcon ? r.prefixIcon + ' ' : '') + cleanName;
                            return { t: label, v: r.value };
                        });
                    }
                });
            }

            const jsonData = JSON.stringify({ 
                macros: { ...(this.macros || {}) }, 
                labels: activeLabelMap, 
                favorites: this.favorites.reduce((acc, f) => { acc[f.t] = f.v; return acc; }, {}), 
                search: this.searchCache, 
                radio: this.radioSelections,
                sliders: this.sliderSelections,
                settings: this.epsSettings
            });
            if (commBox.value !== jsonData) { commBox.value = jsonData; updateInput(commBox); }
        } catch (e) { }
    }

    setupInterceptor() { ['txt2img_generate', 'img2img_generate'].forEach(id => { const btn = gradioApp().getElementById(id); if (!btn) return; btn.addEventListener('mousedown', () => { this.writeToCommunicationBox(); }, true); }); }

    renderContent() {
        const content = document.createElement('div'); content.id = this.CONTENT_ID; content.style.width = '100%';
        Object.keys(this.tags).forEach((key) => {
            if (key === 'radio_setup' || key === 'slider_setup') return;
            const fields = document.createElement('div'); fields.id = `eps-c-${key}`; fields.style.display = 'none'; fields.style.flexDirection = 'column';
            this.renderTagGroups(this.tags[key], key, false, 0, key).forEach((g) => fields.appendChild(g)); content.appendChild(fields);
        });
        return content;
    }

    renderTagGroups(tags, prefix = '', isLocked = false, depth = 0, category = '') {
        if (Array.isArray(tags)) {
            const btnContainer = document.createElement('div'); btnContainer.style.display = 'flex'; btnContainer.style.flexWrap = 'wrap'; btnContainer.style.paddingLeft = '5px'; btnContainer.style.paddingBottom = '4px';
            tags.forEach(t => btnContainer.appendChild(this.renderTagButton(t, t, 'secondary', category))); return [btnContainer];
        } else {
            const keys = Object.keys(tags);
            return keys.map((key, i) => {
                const values = tags[key]; const randomKey = `${prefix}:${key}`;
                if (typeof values === 'string') return this.renderTagButton(key, values, 'secondary', category);
                const fields = EPSElementBuilder.tagFields(depth); const headRow = document.createElement('div'); headRow.style.display = 'flex'; headRow.style.alignItems = 'center'; headRow.style.marginBottom = '2px';
                const bodyContainer = document.createElement('div'); bodyContainer.style.flexWrap = 'wrap'; const isAutoOpen = (i === 0 && depth === 0); bodyContainer.style.display = isAutoOpen ? 'flex' : 'none';
                const sw = document.createElement('span'); sw.textContent = isAutoOpen ? '▼' : '▶'; sw.style.cursor = 'pointer'; sw.style.padding = '0 8px'; sw.style.fontSize = '0.8rem'; sw.style.color = '#ff9800'; sw.style.fontWeight = 'bold';
                sw.onclick = () => { const isOpening = sw.textContent === '▶'; sw.textContent = isOpening ? '▼' : '▶'; bodyContainer.style.display = isOpening ? 'flex' : 'none'; };
                const totalCount = this.countTags(values); const displayKey = `${key} (${totalCount})`;
                const headBtn = this.renderTagButton(displayKey, `@${randomKey}@`, 'primary', category);
                headRow.append(sw, headBtn); fields.append(headRow, bodyContainer);
                this.renderTagGroups(values, randomKey, isLocked, depth + 1, category).forEach(c => bodyContainer.appendChild(c)); return fields;
            });
        }
    }

    toggleTag(tag, toNeg) {
        const prefix = gradioApp().getElementById('tabs').querySelector('.tab-nav button.selected').textContent.includes('img2img') ? 'img2img' : 'txt2img';
        const id = toNeg ? `${prefix}_neg_prompt` : `${prefix}_prompt`; const el = gradioApp().getElementById(id); if (!el) return; const ta = el.querySelector('textarea'); if (!ta) return;
        let currentTags = ta.value.split(',').map(s => s.trim()).filter(s => s); const subTags = tag.split(',').map(s => s.trim()).filter(s => s);
        const allExist = subTags.every(st => currentTags.some(ct => ct.toLowerCase() === st.toLowerCase()));
        if (allExist) currentTags = currentTags.filter(ct => !subTags.some(st => st.toLowerCase() === ct.toLowerCase()));
        else subTags.forEach(st => { if (!currentTags.some(ct => ct.toLowerCase() === st.toLowerCase())) currentTags.push(st); });
        ta.value = currentTags.join(', '); updateInput(ta); this.refreshButtonStyles(); this.updateVisualLayers();
    }
}

window.epsHandlePreviewLoad = function(img, name, startIndex) {
    img.style.opacity = '1'; const oldBadges = img.parentElement.querySelectorAll('.eps-live-badge'); oldBadges.forEach(b => b.remove());
    const badge = document.createElement('div'); badge.className = 'eps-live-badge'; badge.style.position = 'absolute'; badge.style.top = '8px'; badge.style.left = '8px'; badge.style.zIndex = '300'; badge.style.display = 'flex'; badge.style.gap = '6px'; badge.style.flexWrap = 'wrap';
    const match = name.match(/\[([^\]]+)\]/);
    if (match) { match[1].split('').forEach(t => { const item = IMAGE_BADGE_MAP[t]; if (!item) return; const chip = document.createElement('div'); chip.style.background = item.color; chip.style.color = 'white'; chip.style.fontSize = '0.72rem'; chip.style.fontWeight = '900'; chip.style.padding = '2px 8px'; chip.style.borderRadius = '999px'; chip.style.boxShadow = '0 2px 6px rgba(0,0,0,0.35)'; chip.textContent = `◉ ${t} 専用画像`; badge.appendChild(chip); }); } 
    else { const chip = document.createElement('div'); chip.style.background = IMAGE_BADGE_MAP['G'].color; chip.style.color = 'white'; chip.style.fontSize = '0.72rem'; chip.style.fontWeight = '900'; chip.style.padding = '2px 8px'; chip.style.borderRadius = '999px'; chip.style.boxShadow = '0 2px 6px rgba(0,0,0,0.35)'; chip.textContent = '★ 汎用画像'; badge.appendChild(chip); }
    img.parentElement.appendChild(badge);
};

const initEasyPromptSelector = async () => {
    const eps = new EasyPromptSelector(window.jsyaml);
    const setupLauncher = () => {
        const oldWrap = document.getElementById('eps-launcher-wrap'); if (oldWrap) oldWrap.remove();
        const openBtn = EPSElementBuilder.baseButton('❇️展開', { color: 'secondary' });
        const reloadBtn = EPSElementBuilder.baseButton('🔁更新', { color: 'secondary' }); reloadBtn.style.fontWeight = 'bold';
        const exportBtn = EPSElementBuilder.baseButton('保存', { color: 'secondary' }); exportBtn.title = '現在の画像キャッシュをJSONとしてダウンロード';
        exportBtn.onclick = () => { const data = localStorage.getItem('eps_image_status_cache') || '{}'; const blob = new Blob([data], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `eps_cache_backup_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url); };
        const importBtn = EPSElementBuilder.baseButton('読込', { color: 'secondary' }); importBtn.title = 'JSONファイルから画像キャッシュを復元';
        importBtn.onclick = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json'; input.onchange = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { try { const json = JSON.parse(ev.target.result); localStorage.setItem('eps_image_status_cache', JSON.stringify(json)); alert('キャッシュの読み込みに成功しました！\nReloadボタンを押して適用してください。'); } catch(err) { alert('エラー: 正しいJSONファイルではありません'); } }; reader.readAsText(file); }; input.click(); };

        openBtn.onclick = () => { const area = document.getElementById(eps.AREA_ID); if (!area) return; eps.visible = !eps.visible; area.style.display = eps.visible ? 'block' : 'none'; if (eps.visible) eps.refreshButtonStyles(); };
        
        reloadBtn.onclick = async (event) => {
            const originalText = reloadBtn.textContent; reloadBtn.disabled = true;
            try { const isForce = event.shiftKey; if (isForce) { reloadBtn.textContent = '⏳ キャッシュ全消去・再スキャン中...'; localStorage.removeItem('eps_image_status_cache'); } else { reloadBtn.textContent = '⏳ 差分チェック中...'; } reloadBtn.textContent = 'Refreshing Python side...'; const commBox = gradioApp().getElementById('eps-communication-box')?.querySelector('textarea'); if (commBox) { commBox.value = "EPS_RELOAD_REQUEST_" + Date.now(); updateInput(commBox); await new Promise(r => setTimeout(r, 1200)); } reloadBtn.textContent = 'Loading JS...'; await eps.init(); reloadBtn.textContent = isForce ? '⏳ フル再チェック中...' : '⏳ 差分チェック中...'; if (window.epsExtImageChecker) await window.epsExtImageChecker.checkAll(eps, isForce); } catch (e) { } finally { reloadBtn.textContent = originalText; reloadBtn.disabled = false; }
        };

        const wrap = document.createElement('div'); wrap.id = 'eps-launcher-wrap'; wrap.style.display = 'flex'; wrap.style.gap = '5px'; wrap.style.marginTop = '10px';
        wrap.append(openBtn, reloadBtn, exportBtn, importBtn);
        const target = gradioApp().getElementById('txt2img_actions_column') || gradioApp().getElementById('txt2img_tools');
        if (target) target.appendChild(wrap);
    };

    setupLauncher(); await eps.init();

    window.epsExtImageChecker = {
        isRunning: false, STORAGE_KEY: 'eps_image_status_cache',
        async checkImageExists(url) { return new Promise((resolve) => { const img = new Image(); img.onload = () => { img.onload = null; img.onerror = null; resolve(true); }; img.onerror = () => { img.onload = null; img.onerror = null; resolve(false); }; img.src = url; }); },
        async checkAll(epsInstance, forceRefresh = false, targetName = null) {
            if (this.isRunning) return true; if (!epsInstance || !epsInstance.allButtons || epsInstance.allButtons.length === 0) return false;
            this.isRunning = true; let localCache = {};
            if (!forceRefresh) { try { const saved = localStorage.getItem(this.STORAGE_KEY); if (saved) localCache = JSON.parse(saved); } catch (e) { localCache = {}; } }
            const flaggedUpdates = Array.isArray(localCache['_gg_updates']) ? localCache['_gg_updates'] : [];
            const targets = epsInstance.allButtons.filter(item => item.rawTitle && item.isPrompt); const unsearchedTargets = [];

            for (const item of targets) {
                const title = item.rawTitle;
                const isFlagged = flaggedUpdates.some(update => { if (update === title) return true; const hasFlagInTitle = /\s*\[[A-Z]+\]$/.test(title); if (!hasFlagInTitle) { const cleanUpdate = update.replace(/\s*\[[A-Z]+\]$/, '').trim(); if (cleanUpdate === title) return true; } return false; });
                const needsCheck = forceRefresh || !localCache[title] || isFlagged || (targetName && title === targetName);
                if (needsCheck) unsearchedTargets.push(item); else this.updateMark(item, localCache[title] || 'none');
            }
            if (unsearchedTargets.length === 0) { if (flaggedUpdates.length > 0) { delete localCache['_gg_updates']; localStorage.setItem(this.STORAGE_KEY, JSON.stringify(localCache)); } this.isRunning = false; return true; }

            let needSave = false; const chunkSize = 10; 
            for (let i = 0; i < unsearchedTargets.length; i += chunkSize) {
                const chunk = unsearchedTargets.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (item) => {
                    const rawTitle = item.rawTitle; const hasTagPrefix = Object.keys(TAG_PREFIX_MAP).some(prefix => rawTitle.includes(prefix)); let yamlPath = '';
                    if (epsInstance.tagFilePaths) { const fnKey = item.category ? item.category.split('-')[0].trim() : ''; yamlPath = epsInstance.tagFilePaths[fnKey] || epsInstance.tagFilePaths[item.category]; }
                    if (!yamlPath) { localCache[rawTitle] = 'none'; needSave = true; return; }

                    const folderPath = yamlPath.substring(0, yamlPath.lastIndexOf('/') + 1); const basePath = 'file=' + folderPath; const targetExt = 'png'; let foundStatus = 'none'; const cb = `?t=${Date.now()}`;
                    if (hasTagPrefix) {
                        const specificName = rawTitle.trim(); let genericName = rawTitle; Object.keys(TAG_PREFIX_MAP).forEach(prefix => { if (genericName.includes(prefix)) genericName = genericName.replace(prefix, '').trim(); });
                        const urlSpecific = basePath + specificName + '.' + targetExt + cb;
                        if (await this.checkImageExists(urlSpecific)) { const match = rawTitle.match(/\[([CSOE])\]/); foundStatus = match ? match[1] : 'C'; } 
                        else if (specificName !== genericName) { const urlGeneric = basePath + genericName + '.' + targetExt + cb; if (await this.checkImageExists(urlGeneric)) foundStatus = 'G'; }
                    } else {
                        const genericName = rawTitle.trim(); const allowedFlags = Object.keys(IMAGE_BADGE_MAP).filter(k => k !== 'G');
                        for (const char of allowedFlags) { const urlSpecific = basePath + `${genericName} [${char}].` + targetExt + cb; if (await this.checkImageExists(urlSpecific)) { foundStatus = char; break; } }
                        if (foundStatus === 'none') { const urlGeneric = basePath + genericName + '.' + targetExt + cb; if (await this.checkImageExists(urlGeneric)) foundStatus = 'G'; }
                    }
                    localCache[rawTitle] = foundStatus; this.updateMark(item, foundStatus); needSave = true;
                }));
                await new Promise(r => setTimeout(r, 10));
            }
            if (needSave || flaggedUpdates.length > 0) { delete localCache['_gg_updates']; localStorage.setItem(this.STORAGE_KEY, JSON.stringify(localCache)); }
            this.isRunning = false; return true;
        },
        updateMark(item, status) {
            if (!item.btn) return; const hasTagPrefix = Object.keys(TAG_PREFIX_MAP).some(prefix => item.rawTitle.includes(prefix)); let currentStatus = status;
            if (currentStatus === 'specific') { const match = item.rawTitle.match(/\[([CSOE])\]/); currentStatus = match ? match[1] : 'C'; } else if (currentStatus === 'generic') currentStatus = 'G';
            let mark = ''; let color = '';
            if (hasTagPrefix) { mark = '◇'; const badge = IMAGE_BADGE_MAP[currentStatus]; if (badge) { mark = badge.label.split(' ')[0] || '◉'; color = badge.color; } } 
            else { if (currentStatus !== 'none') { const badge = IMAGE_BADGE_MAP[currentStatus]; if (badge) { mark = badge.label.split(' ')[0] || '◉'; color = badge.color; } } }

            let markNode = item.btn.querySelector('.eps-mark-node');
            if (mark !== '') { if (!markNode) { markNode = document.createElement('span'); markNode.className = 'eps-mark-node'; markNode.style.fontWeight = '900'; markNode.style.flexShrink = '0'; item.btn.prepend(markNode); } markNode.textContent = mark; markNode.style.color = color || 'inherit'; } else if (markNode) markNode.remove();
            const displayMark = mark ? mark + ' ' : ''; item.displayTitle = displayMark + (item.cleanDisplayTitle || item.pureTitle || item.rawTitle);
        },
        startAutoTrigger() { let attempts = 0; const timer = setInterval(async () => { attempts++; if (typeof eps !== 'undefined' && eps && eps.allButtons && eps.allButtons.length > 0) { clearInterval(timer); await this.checkAll(eps); } else if (attempts > 30) clearInterval(timer); }, 1000); }
    };
    window.epsExtImageChecker.startAutoTrigger();
};

if (typeof onUiLoaded === 'function') onUiLoaded(initEasyPromptSelector); else document.addEventListener('DOMContentLoaded', initEasyPromptSelector);

/* --- EPS-Kai専用：アコーディオン透視マーカー機能 --- */
const EpsKaiFolderMarker = {
    init() {
        if (window.epskai_folder_marker_active) return;
        window.epskai_folder_marker_active = true;
        // 1秒ごとにフォルダの状態を監視してマーカーを更新
        setInterval(() => this.updateFolders(), 1000);
    },

    updateFolders() {
        // EPS-Kai専用のコンテナIDを直接狙い撃ち
        const root = document.getElementById('eps-v14-content');
        if (!root) return; 

        // EPS-Kai特有の「▶ / ▼」のトグルスイッチを全て探し出す
        const toggles = Array.from(root.querySelectorAll('span')).filter(s => s.textContent === '▶' || s.textContent === '▼');

        toggles.forEach(sw => {
            // スイッチの親要素（headRow）と、隣にあるタイトルボタン（headBtn）を取得
            const headRow = sw.parentElement;
            if (!headRow) return;
            const headBtn = headRow.querySelector('button');
            if (!headBtn) return;
            
            // headRowのすぐ下にあるのが、フォルダの中身（bodyContainer）
            const bodyContainer = headRow.nextElementSibling;
            if (!bodyContainer || bodyContainer.tagName !== 'DIV') return;

            // フォルダの中にあるすべてのボタン（孫・ひ孫含む）をチェック
            const buttons = bodyContainer.querySelectorAll('button');
            let hasPos = false;
            let hasNeg = false;

            buttons.forEach(btn => {
                const bg = btn.style.background || btn.style.backgroundColor || '';
                // EPS-Kaiの refreshButtonStyles() で使われている色情報で判定
                if (bg.includes('#2563eb') || bg.includes('rgb(37, 99, 235)') || bg.includes('rgba(37, 99, 235')) {
                    hasPos = true;
                }
                if (bg.includes('#dc2626') || bg.includes('rgb(220, 38, 38)') || bg.includes('rgba(220, 38, 38')) {
                    hasNeg = true;
                }
                // ポジネガ両方選択時のストライプ柄の判定
                if (bg.includes('stripe') || bg.includes('repeating-linear-gradient') || bg.includes('124, 58, 237')) {
                    hasPos = true;
                    hasNeg = true;
                }
            });

            this.renderMark(headBtn, hasPos, hasNeg);
        });
    },
    
    renderMark(headBtn, hasPos, hasNeg) {
        let markContainer = headBtn.querySelector('.epskai-folder-mark');
        
        if (!hasPos && !hasNeg) {
            if (markContainer) markContainer.remove();
            return;
        }

        if (!markContainer) {
            markContainer = document.createElement('span');
            markContainer.className = 'epskai-folder-mark';
            markContainer.style.cssText = 'display: inline-flex; align-items: center; margin-right: 6px; pointer-events: none;';
            headBtn.insertBefore(markContainer, headBtn.firstChild);
        }

        const stateId = (hasPos ? 'P' : '') + (hasNeg ? 'N' : '');
        if (markContainer.dataset.state === stateId) return;
        markContainer.dataset.state = stateId;

        markContainer.innerHTML = '';
        const baseStyle = 'display: inline-block; width: 9px; height: 9px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.9); box-shadow: 0 1px 2px rgba(0,0,0,0.5); margin-right: 3px;';

        if (hasPos) {
            const dot = document.createElement('span');
            dot.style.cssText = baseStyle + 'background-color: #3b82f6;'; // 青丸
            markContainer.appendChild(dot);
        }
        if (hasNeg) {
            const dot = document.createElement('span');
            dot.style.cssText = baseStyle + 'background-color: #ef4444;'; // 赤丸
            markContainer.appendChild(dot);
        }
    }
};

// UI起動待ち
setTimeout(() => EpsKaiFolderMarker.init(), 2000);