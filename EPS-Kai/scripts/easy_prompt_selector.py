import pathlib
from pathlib import Path
import random
import re
import yaml
import gradio as gr
import json
import os
import time
import modules.scripts as scripts
from modules.scripts import AlwaysVisible, basedir
from modules import shared

# --- Global Settings ---
BASE_DIR = Path(basedir())
TAGS_DIR = BASE_DIR.joinpath('tags')
TMP_DIR = BASE_DIR.joinpath('tmp')
PATH_FILE = TMP_DIR.joinpath('easyPromptSelector.txt')

RELOADED_TAGS = {}

def update_js_index_file(yaml_files):
    try:
        if not TMP_DIR.exists():
            TMP_DIR.mkdir(parents=True, exist_ok=True)
        
        paths = []
        for f in yaml_files:
            try:
                rel_path = f.relative_to(BASE_DIR)
                paths.append(str(rel_path).replace("\\", "/"))
            except ValueError:
                continue

        with open(PATH_FILE, "w", encoding="utf-8") as f:
            f.write("\n".join(paths))
    except Exception:
        pass

def tag_files():
    if not TAGS_DIR.exists():
        TAGS_DIR.mkdir(parents=True, exist_ok=True)
        return []
    return list(TAGS_DIR.rglob("*.yml")) + list(TAGS_DIR.rglob("*.yaml"))

def load_tags():
    global RELOADED_TAGS
    tags = {}
    files = tag_files()
    
    update_js_index_file(files)
    
    for filepath in files:
        try:
            rel_key = str(filepath.relative_to(TAGS_DIR).with_suffix('')).replace("\\", "/")
        except ValueError:
            rel_key = filepath.stem

        try:
            with open(filepath, "r", encoding="utf-8") as file:
                yml = yaml.safe_load(file)
                if yml is None: continue
                
                new_yml = {}
                if isinstance(yml, dict):
                    for category, items in yml.items():
                        if isinstance(items, (list, dict)):
                            new_yml[f"{category} ({len(items)})"] = items
                        else:
                            new_yml[category] = items
                    tags[rel_key] = new_yml
                else:
                    tags[rel_key] = yml
        except Exception:
            continue
    
    RELOADED_TAGS = tags
    return tags

def find_tag(tags, location):
    if not location: return "", ""
    
    file_key = location[0]
    if file_key not in tags:
        found_key = next((k for k in tags.keys() if k.endswith('/' + file_key) or k == file_key), None)
        if found_key:
            file_key = found_key
        else:
            return "", ""

    current_value = tags[file_key]
    last_selected_key = file_key
    
    if len(location) > 1:
        for tag in location[1:]:
            if isinstance(current_value, dict) and tag in current_value:
                current_value = current_value[tag]
                last_selected_key = tag
            else:
                found_match = False
                if isinstance(current_value, dict):
                    for k in current_value.keys():
                        if k.startswith(f"{tag} ("):
                            current_value = current_value[k]
                            last_selected_key = k
                            found_match = True
                            break
                if not found_match: return "", ""
    
    if isinstance(current_value, dict):
        if not current_value: return "", ""
        random_key = random.choice(list(current_value.keys()))
        deep_val = current_value[random_key]
        if isinstance(deep_val, (dict, list)):
            return find_tag({random_key: deep_val}, [random_key])
        else:
            return deep_val, random_key
    elif isinstance(current_value, list):
        if not current_value: return "", ""
        return random.choice(current_value), last_selected_key
        
    return current_value, last_selected_key

def clean_label_text(text):
    if text is None: return ""
    return re.sub(r'\s*\(\d+\)$', '', str(text)).strip()

def process_eps_logic(prompt, comm_json, tags, seed=None):
    if not prompt: return prompt, []
    if seed is not None:
        random.seed(seed)

    found_pairs = []
    sequence_counter = 0
    try:
        master_data = json.loads(comm_json) if comm_json else {}
        macros = master_data.get("macros", {})
        labels_map = master_data.get("labels", {})
        favorites = master_data.get("favorites", {})
        search_cache = master_data.get("search", {})
    except Exception:
        macros, labels_map, favorites, search_cache = {}, {}, {}, {}

    def macro_replacer(match):
        nonlocal sequence_counter
        m_inner = match.group(1)

        m_inner = re.sub(r'^[👤🎲⭐🔥💡]+\s*', '', m_inner).strip()
        if m_inner.startswith("SEARCH:"):
            query = m_inner.replace("SEARCH:", "")
            candidates = search_cache.get(query, [])
            if candidates:
                picked = random.choice(candidates)
                sequence_counter += 1
                found_pairs.append((match.start(), sequence_counter, clean_label_text(picked.get("t", ""))))
                return str(picked.get("v", ""))
            return ""

        if m_inner in macros:
            raw_val = macros[m_inner]
            if m_inner.startswith("RM"):
                choices = [c.strip() for c in raw_val.split(";;") if c.strip()]
                if choices:
                    return random.choice(choices).strip('"').strip("'")
            else:
                sequence_counter += 1
                found_pairs.append((match.start(), sequence_counter, clean_label_text(m_inner)))
                return raw_val
        
        if m_inner in favorites:
            sequence_counter += 1
            found_pairs.append((match.start(), sequence_counter, clean_label_text(m_inner)))
            return favorites[m_inner]

        if m_inner in labels_map:
            sequence_counter += 1
            found_pairs.append((match.start(), sequence_counter, clean_label_text(m_inner)))
            return labels_map[m_inner]

        for file_key, file_data in tags.items():
            clean_file_key = re.sub(r'\s*(\(\d+\)|\[[A-Z]+\])\s*$', '', str(file_key)).strip()
            if clean_file_key == m_inner and isinstance(file_data, dict):
                candidates = []
                for k, v in file_data.items():
                    if isinstance(v, str):
                        candidates.append((k, v))
                if candidates:
                    picked_k, picked_v = random.choice(candidates)
                    clean_picked = re.sub(r'\s*(\(\d+\)|\[[A-Z]+\])\s*$', '', str(picked_k)).strip()
                    sequence_counter += 1
                    found_pairs.append((match.start(), sequence_counter, clean_label_text(picked_k)))
                    return picked_v

            if isinstance(file_data, dict):
                for k, v in file_data.items():
                    clean_key = re.sub(r'\s*(\(\d+\)|\[[A-Z]+\])\s*$', '', str(k)).strip()
                    if clean_key == m_inner:
                        sequence_counter += 1
                        found_pairs.append((match.start(), sequence_counter, clean_label_text(k)))
                        if isinstance(v, str): return v
                        elif isinstance(v, list): return random.choice(v)
                        elif isinstance(v, dict):
                            if "_FULL_" in v: return str(v["_FULL_"])
                            for vv in v.values():
                                if isinstance(vv, str): return vv
                                elif isinstance(vv, list) and vv: return random.choice(vv)
                        return ""

        def search_tag_recursive(data, target):
            nonlocal sequence_counter
            if isinstance(data, dict):
                for k, v in data.items():
                    clean_k = re.sub(r'\s*(\(\d+\)|\[[A-Z]+\])\s*$', '', str(k)).strip()
                    if clean_k == target:
                        sequence_counter += 1
                        found_pairs.append((match.start(), sequence_counter, clean_label_text(k)))
                        if isinstance(v, list): return random.choice(v)
                        elif isinstance(v, str): return v
                    result = search_tag_recursive(v, target)
                    if result: return result
            elif isinstance(data, list):
                if data: return random.choice(data)
            return None

        found = search_tag_recursive(tags, m_inner)
        if found: return str(found)
        return ""

    iteration = 0
    previous_prompt = None
    processed_prompt = re.sub(r'%%([^%]+?)%%', macro_replacer, prompt)

    while iteration < 20 and '%%' in processed_prompt:
        if processed_prompt == previous_prompt: break
        previous_prompt = processed_prompt
        processed_prompt = re.sub(r'%%([^%]+?)%%', macro_replacer, processed_prompt)
        iteration += 1

    iteration_limit = 50
    loop_count = 0
    while loop_count < iteration_limit and '@' in processed_prompt:
        match = re.search(r'(@((?P<num>\d+(-\d+)?)\$$)?(?P<ref>[^>]+?)@)', processed_prompt)
        if not match: break
        full_match_text = match.group(0)
        try:
            num_part = match.group('num')
            min_c = max_c = 1
            if num_part:
                if '-' in num_part:
                    parts = list(map(int, num_part.split('-')))
                    min_c, max_c = min(parts), max(parts)
                else:
                    min_c = max_c = int(num_part)
            
            picked_count = random.randint(min_c, max_c)
            path_parts = match.group('ref').split(':')
            vals, lbls = [], []
            for _ in range(picked_count):
                v, l = find_tag(tags, path_parts)
                if v: vals.append(str(v))
                if l: lbls.append(clean_label_text(l))
            for lbl in lbls:
                sequence_counter += 1
                found_pairs.append((match.start(), sequence_counter, lbl))
            processed_prompt = processed_prompt.replace(full_match_text, ', '.join(vals), 1)
        except Exception:
            processed_prompt = processed_prompt.replace(full_match_text, '', 1)
        loop_count += 1

    processed_prompt = re.sub(r'\s*\|\s*#[A-Fa-f0-9]+', '', processed_prompt)
    processed_prompt = re.sub(r',\s*,', ',', processed_prompt)
    processed_prompt = re.sub(r'^\s*,\s*|\s*,\s*$', '', processed_prompt).strip()
    
    found_pairs.sort(key=lambda x: (x[0], x[1]))
    found_labels = []
    seen = set()

    for _, _, label in found_pairs:
        if label not in seen:
            seen.add(label)
            found_labels.append(label)

    if seed is not None:
        random.seed()
    
    return processed_prompt, found_labels

class Script(scripts.Script):
    def __init__(self):
        super().__init__()
        load_tags()

    def title(self):
        return "EasyPromptSelector"

    def show(self, is_img2img):
        return AlwaysVisible

    def ui(self, is_img2img):
        with gr.Accordion("Easy Prompt Selector", open=False, visible=False):
            eps_comm_box = gr.Textbox(
                label="EPS Communication",
                elem_id="eps-communication-box",
                interactive=True
            )
            python_reload_btn = gr.Button(
                "Python Reload Trigger", 
                elem_id="eps-python-reload-trigger", 
                visible=False
            )
            reload_status = gr.Markdown("", elem_id="eps-reload-status", visible=False)
        
        def reload_action():
            load_tags()
            return f"Reloaded:{time.time()}"
        
        python_reload_btn.click(fn=reload_action, outputs=[reload_status])

        def handle_comm_change(comm_text):
            if comm_text and comm_text.startswith("EPS_RELOAD_REQUEST_"):
                load_tags()
                return ""
            return comm_text

        eps_comm_box.change(fn=handle_comm_change, inputs=[eps_comm_box], outputs=[eps_comm_box])
        
        return [python_reload_btn, eps_comm_box, reload_status]

    def process(self, p, python_reload_btn, eps_comm_box, reload_status):
        global RELOADED_TAGS
        num_images = len(p.all_prompts)
        p._eps_individual_labels = []

        try:
            master_data = json.loads(eps_comm_box) if eps_comm_box else {}
            radio_data = master_data.get("radio", {})
            slider_data = master_data.get("sliders", {}) 
            eps_settings = master_data.get("settings", {}) 
        except Exception:
            radio_data, slider_data, eps_settings = {}, {}, {}

        stealth_posi = eps_settings.get("stealthPosi", {}).get("prompt", "") if isinstance(eps_settings.get("stealthPosi"), dict) else ""
        stealth_nega = eps_settings.get("stealthNega", {}).get("prompt", "") if isinstance(eps_settings.get("stealthNega"), dict) else ""

        radio_prompts_list = [str(item.get("prompt", "")) for item in radio_data.values() if isinstance(item, dict) and item.get("prompt")]
        radio_labels_list = [f'{g}: {item.get("label", "")}' for g, item in radio_data.items() if isinstance(item, dict) and item.get("label")]
        radio_prompt_str = ", ".join(radio_prompts_list)
        p._eps_radio_labels = ", ".join(radio_labels_list)

        slider_prompts_list = [item.get("template", "{val}").replace("{val}", str(item.get("val", ""))) for item in slider_data.values() if isinstance(item, dict) and item.get("active")]
        slider_labels_list = [f'{k}: {item.get("val", "")}' for k, item in slider_data.items() if isinstance(item, dict) and item.get("active")]
        slider_prompt_str = ", ".join(slider_prompts_list)
        p._eps_slider_labels = ", ".join(slider_labels_list)
        
        combined_back_prompts = [x for x in [radio_prompt_str, slider_prompt_str] if x]
        final_back_prompt_str = ", ".join(combined_back_prompts)

        fix_batch_random = eps_settings.get("fixBatchRandom", False)
        
        is_same_hr_p = getattr(p, 'all_hr_prompts', None) is p.all_prompts
        is_same_hr_n = getattr(p, 'all_hr_negative_prompts', None) is p.all_negative_prompts

        for i in range(num_images):
            base_seed = int(p.all_seeds[i]) if i < len(p.all_seeds) else 0
            if fix_batch_random:
                current_seed = int(p.all_seeds[0]) if len(p.all_seeds) > 0 else 0
            else:
                current_seed = base_seed + (i * 99997) 
            
            new_p, lp = process_eps_logic(p.all_prompts[i], eps_comm_box, RELOADED_TAGS, current_seed)
            if final_back_prompt_str:
                new_p = f"{new_p}, {final_back_prompt_str}" if new_p else final_back_prompt_str
            
            if stealth_posi:
                new_p = f"{stealth_posi}, {new_p}" if new_p else stealth_posi

            new_n, ln = process_eps_logic(p.all_negative_prompts[i], eps_comm_box, RELOADED_TAGS, current_seed)
            
            if stealth_nega:
                new_n = f"{stealth_nega}, {new_n}" if new_n else stealth_nega

            p.all_prompts[i] = new_p
            p.all_negative_prompts[i] = new_n
            
            current_image_labels = lp + ln

            if getattr(p, 'all_hr_prompts', None) is not None and not is_same_hr_p and i < len(p.all_hr_prompts):
                new_hr_p, lhp = process_eps_logic(p.all_hr_prompts[i], eps_comm_box, RELOADED_TAGS, current_seed)
                if final_back_prompt_str:
                    new_hr_p = f"{new_hr_p}, {final_back_prompt_str}" if new_hr_p else final_back_prompt_str

                if stealth_posi:
                    new_hr_p = f"{stealth_posi}, {new_hr_p}" if new_hr_p else stealth_posi

                p.all_hr_prompts[i] = new_hr_p
                current_image_labels.extend(lhp)
                
            if getattr(p, 'all_hr_negative_prompts', None) is not None and not is_same_hr_n and i < len(p.all_hr_negative_prompts):
                new_hr_n, lhn = process_eps_logic(p.all_hr_negative_prompts[i], eps_comm_box, RELOADED_TAGS, current_seed)

                if stealth_nega:
                    new_hr_n = f"{stealth_nega}, {new_hr_n}" if new_hr_n else stealth_nega

                p.all_hr_negative_prompts[i] = new_hr_n
                current_image_labels.extend(lhn)

            final_image_labels = list(dict.fromkeys(current_image_labels))
            p._eps_individual_labels.append(final_image_labels)

        # 🌟 【絶対防壁】他の拡張機能に潰されないよう、完成したリストを専用の隠し領域にフルバックアップ！
        p._eps_custom_all_prompts = list(p.all_prompts)
        p._eps_custom_all_negative_prompts = list(p.all_negative_prompts)
        if getattr(p, 'all_hr_prompts', None) is not None:
            p._eps_custom_all_hr_prompts = list(p.all_hr_prompts)
        if getattr(p, 'all_hr_negative_prompts', None) is not None:
            p._eps_custom_all_hr_negative_prompts = list(p.all_hr_negative_prompts)

    # 🌟 【絶対防壁の展開】画像生成のコンマ数秒前にフックして、強制的にEPSのプロンプトを上書きし直す！
    def before_process_batch(self, p, *args, **kwargs):
        if hasattr(p, '_eps_custom_all_prompts'):
            p.all_prompts = list(p._eps_custom_all_prompts)
            p.all_negative_prompts = list(p._eps_custom_all_negative_prompts)
            if hasattr(p, '_eps_custom_all_hr_prompts'):
                p.all_hr_prompts = list(p._eps_custom_all_hr_prompts)
            if hasattr(p, '_eps_custom_all_hr_negative_prompts'):
                p.all_hr_negative_prompts = list(p._eps_custom_all_hr_negative_prompts)
            
            # バッチの現在位置に合わせて p.prompts も強制修正
            n = getattr(p, 'iteration', 0)
            batch_size = getattr(p, 'batch_size', 1)
            p.prompts = p.all_prompts[n * batch_size:(n + 1) * batch_size]
            p.negative_prompts = p.all_negative_prompts[n * batch_size:(n + 1) * batch_size]
            
            # 念のためkwargsのプロンプトリストも書き換える
            if 'prompts' in kwargs and isinstance(kwargs['prompts'], list):
                kwargs['prompts'].clear()
                kwargs['prompts'].extend(p.prompts)

    def process_batch(self, p, *args, **kwargs):
        self.before_process_batch(p, *args, **kwargs)

    def postprocess(self, p, processed, python_reload_btn, eps_comm_box, reload_status):
        if not hasattr(p, '_eps_individual_labels'):
            return

        if hasattr(processed, 'infotexts'):
            for i in range(len(processed.infotexts)):
                if hasattr(p, '_eps_radio_labels') and p._eps_radio_labels:
                    if "EPS_Radio:" not in processed.infotexts[i]:
                        processed.infotexts[i] += f', EPS_Radio: "{p._eps_radio_labels}"'
                if hasattr(p, '_eps_slider_labels') and p._eps_slider_labels:
                    if "EPS_Slider:" not in processed.infotexts[i]:
                        processed.infotexts[i] += f', EPS_Slider: "{p._eps_slider_labels}"'
                
                if "Selected_Index:" in processed.infotexts[i]: continue
                
                idx = i if i < len(p._eps_individual_labels) else 0
                if idx < len(p._eps_individual_labels) and p._eps_individual_labels[idx]:
                    joined_labels = ", ".join(p._eps_individual_labels[idx])
                    processed.infotexts[i] += f', Selected_Index: "{joined_labels}"'

        if hasattr(processed, 'info'):
            if hasattr(p, '_eps_radio_labels') and p._eps_radio_labels:
                if "EPS_Radio:" not in processed.info:
                    processed.info += f', EPS_Radio: "{p._eps_radio_labels}"'
            if hasattr(p, '_eps_slider_labels') and p._eps_slider_labels:
                if "EPS_Slider:" not in processed.info:
                    processed.info += f', EPS_Slider: "{p._eps_slider_labels}"'
            if "Selected_Index:" not in processed.info:
                if len(p._eps_individual_labels) > 0 and p._eps_individual_labels[0]:
                    joined_labels = ", ".join(p._eps_individual_labels[0])
                    processed.info += f', Selected_Index: "{joined_labels}"'

import modules.script_callbacks as script_callbacks
import re

def eps_on_before_image_saved(params):
    if not hasattr(params.p, '_eps_individual_labels'):
        return
        
    try:
        parameters = params.pnginfo.get("parameters", "")
        
        # 1. 既存のEPSタグの追加（ここはそのまま）
        if hasattr(params.p, '_eps_radio_labels') and params.p._eps_radio_labels:
            if "EPS_Radio:" not in parameters:
                params.pnginfo["parameters"] += f', EPS_Radio: "{params.p._eps_radio_labels}"'
                parameters = params.pnginfo["parameters"]

        if hasattr(params.p, '_eps_slider_labels') and params.p._eps_slider_labels:
            if "EPS_Slider:" not in parameters:
                params.pnginfo["parameters"] += f', EPS_Slider: "{params.p._eps_slider_labels}"'
                parameters = params.pnginfo["parameters"]

        if "Selected_Index:" in parameters: return
        
        # 🌟 2. 【核心】現物プロンプト逆算マッチングロジック
        idx = -1
        param_lines = parameters.strip().split('\n')
        
        if param_lines and hasattr(params.p, 'all_prompts'):
            # 保存されようとしている画像の実際のポジティブプロンプトを取得
            current_image_prompt = param_lines[0].strip()
            
            # 生成された全プロンプトのリストから、完全に一致するインデックスを特定
            for i, p_prompt in enumerate(params.p.all_prompts):
                if p_prompt.strip() == current_image_prompt:
                    idx = i
                    break
                    
        # 3. プロンプトで特定できなかった場合のセーフティ（シード値逆算）
        if idx == -1:
            seed_match = re.search(r'Seed:\s*(\d+)', parameters)
            if seed_match and hasattr(params.p, 'all_seeds'):
                saved_seed = int(seed_match.group(1))
                if saved_seed in params.p.all_seeds:
                    idx = params.p.all_seeds.index(saved_seed)
                    
        # 4. 万が一のフォールバック
        if idx == -1:
            iteration = getattr(params.p, 'iteration', 0)
            position = getattr(params, 'batch_index', 0)
            idx = position + (iteration * getattr(params.p, 'batch_size', 1))
                
        # 正確に特定したインデックスに基づいてラベルを書き込み
        if 0 <= idx < len(params.p._eps_individual_labels) and params.p._eps_individual_labels[idx]:
            joined_labels = ", ".join(params.p._eps_individual_labels[idx])
            params.pnginfo["parameters"] += f', Selected_Index: "{joined_labels}"'
            
    except Exception as e:
        pass

script_callbacks.on_before_image_saved(eps_on_before_image_saved)