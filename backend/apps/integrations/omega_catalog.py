import requests
import os

# Беремо ключ безпосередньо з системи (його сюди передасть Coolify)
OMEGA_GLOBAL_KEY = os.getenv("OMEGA_GLOBAL_KEY")
OMEGA_API_BASE = "https://public.omega.page/public/api/v1.0"

def get_product_id_by_article(article):
    """
    Шукає числовий ProductId в Омезі за текстовим артикулом.
    """
    if not OMEGA_GLOBAL_KEY:
        print("Системне повідомлення: OMEGA_GLOBAL_KEY не знайдено.")
        return None

    url = f"{OMEGA_API_BASE}/product/pricelist/paged"
    payload = {
        "Key": OMEGA_GLOBAL_KEY,
        "Search": article,
        "Take": 1
    }
    
    try:
        response = requests.post(url, json=payload, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('Success') and data.get('Data') and len(data['Data']) > 0:
                return data['Data'][0].get('ProductId')
    except Exception as e:
        print(f"Помилка пошуку ProductId: {e}")
        
    return None

def get_crosses_for_article(article):
    """
    Приймає артикул, повертає список ВСІХ аналогів (включно з оригіналом).
    """
    cross_codes = [article.strip().upper()] 
    
    if not OMEGA_GLOBAL_KEY:
        return cross_codes 
    
    product_id = get_product_id_by_article(article)
    
    if not product_id:
        return cross_codes 
        
    url = f"{OMEGA_API_BASE}/product/getAllCrosses"
    payload = {
        "Key": OMEGA_GLOBAL_KEY,
        "ProductId": product_id
    }
    
    try:
        response = requests.post(url, json=payload, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('Success'):
                crosses = data.get('Data', [])
                for cross in crosses:
                    code = cross.get('Code')
                    if code:
                        clean_code = str(code).strip().upper()
                        if clean_code not in cross_codes:
                            cross_codes.append(clean_code)
    except Exception as e:
        print(f"Помилка отримання кросів: {e}")
        
    return cross_codes
