# SABİS GPA Hesaplayıcı (SABIS-Note-Assistant) 🚀

Sakarya Üniversitesi öğrencileri için geliştirilmiş bu Chrome / Edge uzantısı,
**SABİS** “Ders” ve “Transkript” ekranlarında

* **Eksik not ekleyerek** “ne olurdu?” senaryoları çalıştırmanıza  
* **AKTS kredilerini güncelleyip** dönem / genel GPA’yı anında görmenize  
* Tüm bunları **renkli, canlı geri bildirim** ile takip etmenize olanak tanır.

---

## Kurulum (Geliştirici Mod)

1. Depoyu ZIP olarak indirin veya `git clone` yapın.  
2. Tarayıcıda `chrome://extensions` → **Geliştirici Modu**nu açın.  
3. **“Paketlenmemiş uzantı yükle”** → proje kök klasörünü seçin  
   (içinde `manifest.json` bulunur).  
4. Mavi uzantı simgesi göründüğünde kurulum tamamdır.

---

## Özellikler

| # | Açıklama |
|---|----------|
| **1 – Dinamik Not Kutuları** | Notu girilmemiş hücrelerde otomatik **textbox** (0 – 100). |
| **2 – Giriş Doğrulama** | 0-100 dışı veya harf/özel karakter girişi engellenir. |
| **3 – Canlı GPA Hesabı** | Her değişiklikte **dönem ve genel** GPA yeniden hesaplanır.<br>• **Yeşil ≥ 75** • **Mavi 55–74** • **Kırmızı < 55** |
| **4 – AKTS Düzenle Toggle** | Kart başlığındaki **❌ / ✅ AKTS Düzenle** <br>→ AKTS hücrelerinde − / ＋ butonları & doğrudan sayı girişi<br>→ Tek tıkla orijinal değere sıfırlama |
| **5 – “Ortalamaya Girmez”** | Yıldız `*` işaretli dersler (STAJ I, II …) otomatik **hesap dışı** tutulur. |

---

## Önce / Sonra

| Önce | Sonra |
|:--:|:--:|
| ![Önce 1](assets/images/before1.png) | ![Sonra 1](assets/images/after1.png) |
| ![Önce 2](assets/images/before2.png) | ![Sonra 2](assets/images/after2.png) |

---

## Klasör Yapısı

SABIS-Note-Assistant/
├─ manifest.json               # uzantı bildirimi  (kökte)            
├─ README.md
│
├─ assets/
│   ├─ icons/                  # uzantı ikonları
│   │   ├─ icon16.png
│   │   ├─ icon48.png
│   │   └─ icon128.png
│   └─ images/                 # ekran görüntüleri
│       ├─ before1.png
│       ├─ after1.png
│       ├─ before2.png
│       └─ after2.png
│
├─ src/                        # kaynak kodlar
│   ├─ content/
│   │   └─ content.js          # /Ders sayfası
        └─ transkript.js       # /Transkript sayfası
        └─ background.js       # service-worker
│   └─ popup/
│       ├─ popup.html
│       ├─ popup.js
│
├─ AverageCalculator.crx
└─ AverageCalculator.pem


## Katkı & Destek

* ⭐ Projeyi beğendiyseniz **Star** verin  
* 🔀 **Fork + PR** göndererek yeni özellik ekleyin  
* 🐞 Sorun ve önerilerinizi **Issues** bölümünde paylaşın  

Her geri bildirim bizim için çok değerli!

---

## İletişim

**E-posta:** ozdemirosmantahir@gmail.com
**E-posta:** suleymansametkaya@gmail.com
