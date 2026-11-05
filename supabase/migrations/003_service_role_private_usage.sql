-- Server (service_role) ham lv_query / lv_count orqali yordamchi funksiyalarni chaqira olsin
-- (002 dan keyin qo'llanadi; usiz serverdagi sanash/qidiruv so'rovlari 403 qaytaradi)
grant usage on schema lv_private to service_role;
grant execute on all functions in schema lv_private to service_role;
