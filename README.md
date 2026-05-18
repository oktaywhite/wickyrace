# WickyRace - Wikipedia Yarışı

Gartic tarzında, arkadaşlarınızla Wikipedia üzerinden yarışabileceğiniz web tabanlı bir oyun.

## Özellikler
- **Lobi Sistemi:** Davet kodu ile arkadaşlarınızla aynı odaya girin.
- **Canlı Takip:** Kimin kaç tıklamada olduğunu anlık olarak görün.
- **Kuyruk Yönetimi:** Lobi kurucusu istediği kadar başlangıç ve hedef noktası ekleyebilir.
- **Puanlama:** En az tıklama ile hedefe ulaşan ilk 3 oyuncu puan kazanır (100, 75, 50).
- **Modern Arayüz:** Karanlık mod, glassmorphism ve akıcı animasyonlar.

## Kurulum ve Çalıştırma

1.  **Bağımlılıkları Yükleyin:**
    ```bash
    npm install
    ```

2.  **Oyunu Başlatın:**
    ```bash
    npm start
    ```

3.  **Tarayıcıda Açın:**
    `http://localhost:3000` adresine giderek oynamaya başlayın!

## Nasıl Oynanır?
1. Bir kullanıcı "Lobi Kur" diyerek odayı oluşturur.
2. Diğer kullanıcılar oda koduyla giriş yapar.
3. Kurucu, başlangıç ve hedef Wikipedia başlıklarını ayarlar (örn: "Albert Einstein" -> "Pizza").
4. Oyun başladığında, Wikipedia sayfalarındaki linklere tıklayarak hedefe ulaşmaya çalışın.
5. En az tıklama ile en hızlı giden kazanır!

## Notlar
- Wikipedia API'si kullanıldığı için internet bağlantısı gereklidir.
- Gerçek zamanlı iletişim için Socket.io kullanılmıştır.
