// Paket sesuai flyer BWI 2026 (CR-04, Okt 2026). Harga & isi paket dari flyer klien;
// JAM SIMULATOR (`hours`) MASIH DUMMY — flyer tidak menyebut jam. Ubah di Admin → Pengaturan → Paket.
// "Recurrent by pair" Rp 46 jt = 2 pilot berpasangan → 1 pendaftaran = 1 peserta = Rp 23 jt
// (sesuai contoh invoice klien #29092026-069P). Paket "+ Stand in": pilot pendamping disediakan BWI.

export const PACKAGES = [
  {
    code: "itr", sort: 1, hours: 40, price: 255_000_000n, highlight: false,
    name_id: "Initial Type Rating", name_en: "Initial Type Rating", short_id: "Initial Type Rating", short_en: "Initial Type Rating",
    description_id: "Program type rating lengkap sampai DGCA Sim Check.", description_en: "Complete type rating programme up to the DGCA Sim Check.",
    bullets_id: ["Ground Training", "Simulator Training", "Makan & transport", "DGCA Written Test", "DGCA Sim Check"],
    bullets_en: ["Ground Training", "Simulator Training", "Meals & transport", "DGCA Written Test", "DGCA Sim Check"],
  },
  {
    code: "pc", sort: 2, hours: 8, price: 23_000_000n, highlight: true,
    name_id: "Recurrent (by pair)", name_en: "Recurrent (by pair)", short_id: "Recurrent (by pair)", short_en: "Recurrent (by pair)",
    description_id: "Datang berpasangan (by pair): Rp 46 jt per pasang = Rp 23 jt per pilot. Pasangan mendaftar masing-masing.",
    description_en: "Come as a pair: Rp 46m per pair = Rp 23m per pilot. Each pilot registers separately.",
    bullets_id: ["Ground Training", "LOFT", "Proficiency Check", "License Endorsement"],
    bullets_en: ["Ground Training", "LOFT", "Proficiency Check", "License Endorsement"],
  },
  {
    code: "pc-si", sort: 3, hours: 8, price: 25_000_000n, highlight: false,
    name_id: "Recurrent (by pax)", name_en: "Recurrent (by pax)", short_id: "Recurrent (by pax)", short_en: "Recurrent (by pax)",
    description_id: "Untuk pilot yang datang sendiri (by pax) — pilot pendamping (stand in) disediakan BWI.",
    description_en: "For pilots coming alone (by pax) — a stand-in pilot is provided by BWI.",
    bullets_id: ["Ground Training", "LOFT", "Proficiency Check", "License Endorsement", "Stand in"],
    bullets_en: ["Ground Training", "LOFT", "Proficiency Check", "License Endorsement", "Stand in"],
  },
  {
    code: "atpl-course", sort: 4, hours: 16, price: 75_000_000n, highlight: false,
    name_id: "ATPL Course", name_en: "ATPL Course", short_id: "ATPL Course", short_en: "ATPL Course",
    description_id: "Persiapan & penerbitan lisensi ATP.", description_en: "Preparation & issuance of the ATP licence.",
    bullets_id: ["Ground Refreshment", "Simulator Training", "Makan", "DGCA Sim Check", "Penerbitan ATP License"],
    bullets_en: ["Ground Refreshment", "Simulator Training", "Meals", "DGCA Sim Check", "Issuance of ATP License"],
  },
  {
    code: "atpl-si", sort: 5, hours: 16, price: 78_000_000n, highlight: false,
    name_id: "ATPL Course (Stand in)", name_en: "ATPL Course (Stand in)", short_id: "ATPL Course (Stand in)", short_en: "ATPL Course (Stand in)",
    description_id: "ATPL Course dengan pilot pendamping (stand in) dari BWI.", description_en: "ATPL Course with a stand-in pilot provided by BWI.",
    bullets_id: ["Ground Refreshment", "Simulator Training", "Makan", "DGCA Sim Check", "Penerbitan ATP License", "Stand in"],
    bullets_en: ["Ground Refreshment", "Simulator Training", "Meals", "DGCA Sim Check", "Issuance of ATP License", "Stand in"],
  },
  {
    code: "mcc", sort: 6, hours: 20, price: 60_000_000n, highlight: false,
    name_id: "MCC Course", name_en: "MCC Course", short_id: "MCC Course", short_en: "MCC Course",
    description_id: "Multi Crew Cooperation.", description_en: "Multi Crew Cooperation.",
    bullets_id: ["Ground Training", "Simulator Training", "Proficiency Check", "License Endorsement", "Stand in"],
    bullets_en: ["Ground Training", "Simulator Training", "Proficiency Check", "License Endorsement", "Stand in"],
  },
];

/** Paket dummy lama (sebelum CR-04) — dinonaktifkan, tidak dihapus (riwayat pendaftaran tetap merujuk). */
export const OLD_PACKAGE_CODES = ["ppc", "rec", "atpl", "trf"];
