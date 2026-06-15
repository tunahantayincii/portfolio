# Tunahan Tayıncı Portfolio: Netlify + Supabase Kurulumu

Repository:

```text
https://github.com/tunahantayincii/portfolio.git
```

## 1. Supabase projesini oluşturun

1. Supabase hesabınızda yeni bir proje oluşturun.
2. Supabase panelinde **SQL Editor** bölümünü açın.
3. Projedeki `supabase-setup.sql` dosyasının tamamını SQL Editor içine yapıştırıp çalıştırın.
4. **Project Settings > API** bölümünden aşağıdaki değerleri bulun:
   - Project URL
   - `service_role` secret key

`service_role` anahtarını kimseyle paylaşmayın ve GitHub'a yüklemeyin.

## 2. GitHub repository'sini Netlify'a bağlayın

1. Netlify'da **Add new project > Import an existing project** seçeneğini açın.
2. GitHub'ı ve `tunahantayincii/portfolio` repository'sini seçin.
3. Build command alanını boş bırakın.
4. Publish directory alanına `.` yazın.

## 3. Netlify ortam değişkenlerini ekleyin

Netlify panelinde **Site configuration > Environment variables** bölümüne aşağıdaki değerleri ekleyin:

```text
ADMIN_USERNAME = tunahantayinci
ADMIN_PASSWORD = uzun ve benzersiz bir şifre
ADMIN_SESSION_SECRET = en az 32 karakterlik rastgele bir değer
SUPABASE_URL = Supabase Project URL
SUPABASE_SERVICE_ROLE_KEY = Supabase service_role secret key
```

Değişkenleri ekledikten sonra **Deploys > Trigger deploy > Deploy site** ile yeniden deploy edin.

## 4. İlk içerik kaydı

1. Yayındaki `/admin.html` adresine gidin.
2. Netlify ortam değişkenlerine yazdığınız kullanıcı adı ve şifreyle giriş yapın.
3. Genel içerikte küçük bir değişiklik yapıp kaydedin.

Bu ilk kayıt varsayılan içeriği Supabase'e aktarır. Bundan sonraki metin, proje ve görsel değişiklikleri tüm ziyaretçilere görünür.

## Güvenlik özellikleri

- Kullanıcı adı, şifre ve Supabase servis anahtarı kaynak kodunda bulunmaz.
- Kimlik doğrulama Netlify Functions üzerinde yapılır.
- Oturum çerezi `HttpOnly`, `Secure`, `SameSite=Strict` özelliklidir ve 8 saat geçerlidir.
- İçerik yazma ve medya yükleme işlemleri geçerli admin oturumu gerektirir.
- Tarayıcı Supabase servis anahtarına hiçbir zaman erişemez.
- Yönetim sayfası önbelleğe alınmaz ve arama motorlarına kapalıdır.
- `şifre.txt`, `.env` ve Netlify yerel dosyaları GitHub'a yüklenmez.
