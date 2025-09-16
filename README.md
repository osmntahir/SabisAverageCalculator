# 🎓 SABİS NOT HESAPLAYICI

> **Modern ve kullanıcı dostu tasarımla Sabis öğrencileri için not ortalaması hesaplama eklentisi**

[![Versiyon](https://img.shields.io/badge/versiyon-1.0-blue.svg)](https://github.com/osmntahir/SabisAverageCalculator)
[![Lisans](https://img.shields.io/badge/lisans-MIT-green.svg)](LICENSE)

## ✨ Yeni Özellikler (v1.0)

### 🎨 **Yenilenmiş Modern Tasarım**
- **Gradient arka plan** ve **glassmorphism** efektleri
- **FontAwesome iconları** ile zenginleştirilmiş arayüz  
- **Responsive tasarım** ve **smooth animasyonlar**
- **Modern toggle switch** ve **renkli feedback** sistemi

### 🖼️ **Profesyonel Icon Seti**
- 4 farklı boyutta (16px, 32px, 48px, 128px) **özel tasarım iconlar**
- **Gradient renkler** ve **hesap makinesi** temalı görsel
- Chrome mağazası için **profesyonel görünüm**

### ☕ **Geliştirici Desteği** *(Yakında)*
- **Buy Me Coffee** entegrasyonu hazır (şu anda yorum satırında)
- Kolay aktivasyon için hazır kod yapısı

## 🚀 Kurulum

Bu uzantıyı tarayıcınıza yüklemek için aşağıdaki adımları izleyin:

1. **Klasörü İndirin:** İlk olarak, uzantı dosyalarını içeren klasörü bilgisayarınıza indirin.

2. **Geliştirici Modunu Etkinleştirin:** Tarayıcınızın ayarlarına gidin ve "Uzantılar" veya "Eklentiler" kısmını bulun. Bu bölümde, "Geliştirici modu" seçeneğini bulun ve aktif hale getirin.

3. **Paketlenmemiş Uzantıyı Yükle:** Geliştirici modunu etkinleştirdikten sonra, bilgisayarınıza indirdiğiniz klasörü bulun. Ardından, tarayıcınızın uzantılar bölümüne geri dönün. "Paketlenmemiş uzantıyı yükle" (veya benzer bir seçenek) butonuna tıklayın.

4. **Klasörü Seçin:** Bir dosya seçme penceresi açılacaktır. İndirdiğiniz uzantı dosyalarının bulunduğu klasörü seçin. Ana klasörü seçtiğinizden emin olun, içindeki dosyaları değil.

5. **Uzantıyı Yükleyin:** Klasörü seçtikten sonra, "Aç" veya "Seç" butonuna tıklayın. Tarayıcı, klasördeki uzantı dosyalarını yükleyecek ve uzantıyı kuracaktır.

---

## Özellikler

### 1. **Girilmeyen Notlar Yerine TextBox Eklendi**
- Girilmeyen notlar yerine istediğiniz notları girerek simüle edebilirsiniz.

### 2. **Giriş Kısıtlamaları**
- Not giriş kutularına yalnızca 0-100 arasında sayısal değerler girilebilir.
- Harf veya sembol gibi geçersiz karakter girişleri engellenir.
- Kullanıcı, 0'dan küçük veya 100'den büyük bir değer girmeye çalışırsa, bu girişe izin verilmez (uyarı gösterilmeden engellenir).

### 3. **Dinamik Ortalama Hesaplama**
- Kullanıcı her not girdiğinde, ortalama otomatik olarak yeniden hesaplanır ve güncellenir.
- Ortalama, belirli aralıklara göre renklendirilir:
  - **Yeşil:** Yüksek (75 üzeri)
  - **Mavi:** Orta (55-75 arası)
  - **Kırmızı:** Düşük (55 altı)

### 4. **Gelişmiş Tasarım**
- Uzantının aç/kapa (toggle) butonu yenilendi. Artık daha modern ve estetik bir görünüme sahip.
- Arayüz, kullanıcı dostu ve tarayıcı içi tasarıma uyumlu hale getirildi.

### 5. **Aç/Kapa Özelliği**
- Uzantıyı açmak veya kapatmak için bir toggle (anahtar) düğmesi eklenmiştir.
- Düğme değiştirilince tarayıcı sekmesi otomatik olarak yenilenir ve uzantı aktif/pasif hale gelir.

---

## Kullanım Öncesi ve Sonrası Örneği

<div style="display: flex; gap: 20px;">
  <div>
    <h4>Kullanım Öncesi</h4>
    <img src="https://github.com/user-attachments/assets/d8ddb88d-3b11-4a87-8ee6-a0a792ab3329" alt="Kullanım Öncesi" style="max-width: 300px;">
  </div>
  <div>
    <h4>Kullanım Sonrası</h4>
    <img src="https://github.com/user-attachments/assets/43abd062-98d0-4ef8-b0fa-1fa26188a20c" alt="Kullanım Sonrası" style="max-width: 300px;">
  </div>
</div>



---

## Destek Olmak İsterseniz

Bu projeyi daha fazla geliştirmek için desteğinize ihtiyacımız var. Eğer katkıda bulunmak isterseniz:
- **Fork** yaparak projeye katkıda bulunabilirsiniz.
- Öneri ve geliştirme fikirlerinizi bizimle paylaşabilirsiniz.

Her türlü geri bildirim bizim için çok değerli! 

---

## İletişim

- **E-posta:** ozdemirosmantahir@gmail.com


---

## Güvenlik Notu (Önemli)

Proje kök dizininde gizli anahtar dosyası (*.pem) bulunmamalıdır. Eğer daha önce paketleme için bir `.pem` dosyası kullanıldıysa, bu dosya proje kökünden taşındı.

- Taşınan anahtar konumu: `~/.extension_keys/AverageCalculator.pem`
- Mağazaya paketleme yaparken bu anahtarı kullanmak isterseniz, geçici olarak kopyalayın veya paketleme adımında ilgili yolu gösterin.

Bu repository artık `.pem` dosyalarını `.git` tarafından takip etmeyecek şekilde yapılandırılmıştır (`.gitignore` eklenmiştir).

Teşekkürler! 🚀
