import os
import gradio as gr
import base64
from pathlib import Path
import modules.scripts as scripts
from modules.scripts import AlwaysVisible
import base64
import urllib.parse

# ターゲットディレクトリの解決
BASE_DIR = Path(scripts.basedir())
TAGS_DIR = BASE_DIR.joinpath('tags')

def scan_yaml_files():
    """
    tags フォルダ内をスキャンして YAML パス一覧をカンマ区切りで返す
    """
    paths = []
    search_dir = TAGS_DIR
    
    if not search_dir.exists():
        # 予備の探索 (cwd基準)
        alt_path = Path(os.getcwd()).joinpath('extensions', 'sdweb-easy-prompt-selector', 'tags')
        if alt_path.exists():
            search_dir = alt_path
        else:
            return ""

    for f in search_dir.rglob("*"):
        if f.suffix.lower() in [".yml", ".yaml"]:
            try:
                full_path = str(f.absolute()).replace("\\", "/")
                # WebUIが読み取り可能な extensions/... 形式を優先
                if "extensions" in full_path:
                    parts = full_path.split("extensions")
                    rel_path = "extensions" + parts[-1]
                    paths.append(rel_path)
                else:
                    paths.append(full_path)
            except Exception as e:
                print(f"[GG] Path processing error: {e}")
    
    return ",".join(paths)

def save_yaml_handler(file_path, content):
    try:
        # Base64デコード
        decoded_content = urllib.parse.unquote(base64.b64decode(content).decode('utf-8'))
        
        target_path = Path(file_path)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(target_path, "w", encoding="utf-8", newline='\n') as f:
            f.write(decoded_content)
            
        return "SUCCESS", scan_yaml_files()
    except Exception as e:
        return f"ERROR: {str(e)}", scan_yaml_files()

def save_image_handler(yaml_path, image_name, base64_data):
    """
    JS側から送られたBase64画像データをデコードして保存する
    yaml_path: 現在編集中のYAMLのパス（ディレクトリ特定の基準用）
    image_name: 保存するファイル名 (例: "MyButton [C].png")
    base64_data: data:image/png;base64,... 形式のデータ
    """
    if not image_name or not base64_data:
        return "ERROR: Missing image data."

    try:
        # Base64ヘッダーの除去
        if "," in base64_data:
            base64_data = base64_data.split(",")[1]
        
        img_bytes = base64.b64decode(base64_data)
        
        # 保存先ディレクトリの決定 (YAMLと同じ場所)
        root_dir = Path(os.getcwd())
        if yaml_path.startswith("extensions"):
            base_dir = root_dir.joinpath(yaml_path).parent
        else:
            base_dir = Path(yaml_path).parent
            
        target_path = base_dir.joinpath(image_name)
        
        # 保存実行
        with open(target_path, "wb") as f:
            f.write(img_bytes)
            
        return f"SUCCESS: Saved {image_name}"
    except Exception as e:
        print(f"[GG] Image save error: {e}")
        return f"ERROR: {str(e)}"

class GenesisGearScript(scripts.Script):
    def title(self):
        return "Genesis Gear Engine"

    def show(self, is_img2img):
        return AlwaysVisible

    def ui(self, is_img2img):
        initial_paths = scan_yaml_files()

        # JSと通信するための非表示コンポーネント群
        with gr.Accordion("Genesis Gear Hub", open=False, visible=False):
            # --- YAML用 ---
            yaml_data_hub = gr.Textbox(value=initial_paths, elem_id="gg_yaml_hub_v2")
            save_path_input = gr.Textbox(elem_id="gg_save_path_in")
            # python側
            save_content_input = gr.Textbox(elem_id="gg_save_content_in", lines=20, show_copy_button=True)
            save_trigger_btn = gr.Button(elem_id="gg_save_trigger_btn")
            
            # --- 画像用 ---
            # どのYAMLの階層に保存すべきかを知るために yaml_path_in を再利用
            img_name_input = gr.Textbox(elem_id="gg_img_name_in")
            img_data_input = gr.Textbox(elem_id="gg_img_data_in")
            img_save_trigger_btn = gr.Button(elem_id="gg_img_save_trigger_btn")
            
            # --- 共通 ---
            rescan_trigger_btn = gr.Button(elem_id="gg_rescan_trigger_btn")
            save_status = gr.Textbox(elem_id="gg_save_status_out")
            
            # --- イベント定義 ---
            
            # YAML保存
            save_trigger_btn.click(
                fn=save_yaml_handler,
                inputs=[save_path_input, save_content_input],
                outputs=[save_status, yaml_data_hub]
            )
            
            # 画像保存
            img_save_trigger_btn.click(
                fn=save_image_handler,
                inputs=[save_path_input, img_name_input, img_data_input],
                outputs=[save_status]
            )
            
            # スキャン
            rescan_trigger_btn.click(
                fn=scan_yaml_files,
                outputs=[yaml_data_hub]
            )
            
        return [yaml_data_hub, save_path_input, save_content_input, save_trigger_btn, save_status, rescan_trigger_btn]

print(f"[GG] Engine Extension Loaded. Target: {TAGS_DIR}")