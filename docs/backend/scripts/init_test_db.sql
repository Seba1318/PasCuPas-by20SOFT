-- Rulat o singură dată de containerul PostGIS, la prima pornire (volum gol).
-- Testele (pytest) folosesc o bază separată, ca să nu atingă datele de dezvoltare.
CREATE DATABASE navigare_test OWNER navigare;
