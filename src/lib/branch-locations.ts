export const BRANCH_LOCATIONS: Record<string, { state: string; branches: string[] }> = {
  Ahmedabad: {
    state: "Gujarat",
    branches: ["Main Branch", "CG Road Branch", "Navrangpura Branch", "Satellite Branch"],
  },
  Bangalore: {
    state: "Karnataka",
    branches: ["Main Branch", "Koramangala Branch", "Indiranagar Branch", "Whitefield Branch"],
  },
  Bhopal: {
    state: "Madhya Pradesh",
    branches: ["Main Branch", "MP Nagar Branch", "Arera Colony Branch"],
  },
  Bhubaneswar: {
    state: "Odisha",
    branches: ["Main Branch", "Sahid Nagar Branch", "Jaydev Vihar Branch"],
  },
  Chandigarh: {
    state: "Chandigarh",
    branches: ["Main Branch", "Sector 17 Branch", "Sector 22 Branch"],
  },
  Chennai: {
    state: "Tamil Nadu",
    branches: ["Main Branch", "Anna Nagar Branch", "T Nagar Branch", "Adyar Branch"],
  },
  Coimbatore: {
    state: "Tamil Nadu",
    branches: ["Main Branch", "RS Puram Branch", "Gandhipuram Branch"],
  },
  Delhi: {
    state: "Delhi",
    branches: ["Main Branch", "Connaught Place Branch", "Rohini Branch", "Dwarka Branch"],
  },
  Faridabad: {
    state: "Haryana",
    branches: ["Main Branch", "Sector 15 Branch", "Sector 16 Branch"],
  },
  Ghaziabad: {
    state: "Uttar Pradesh",
    branches: ["Main Branch", "Indirapuram Branch", "Raj Nagar Branch"],
  },
  Gurugram: {
    state: "Haryana",
    branches: ["Main Branch", "Sector 14 Branch", "Sector 29 Branch", "DLF Phase 1 Branch"],
  },
  Hyderabad: {
    state: "Telangana",
    branches: ["Main Branch", "Banjara Hills Branch", "Jubilee Hills Branch", "Madhapur Branch"],
  },
  Indore: {
    state: "Madhya Pradesh",
    branches: ["Main Branch", "Vijay Nagar Branch", "Palasia Branch"],
  },
  Jaipur: {
    state: "Rajasthan",
    branches: ["Main Branch", "MI Road Branch", "Vaishali Nagar Branch", "Malviya Nagar Branch"],
  },
  Kanpur: {
    state: "Uttar Pradesh",
    branches: ["Main Branch", "Swaroop Nagar Branch", "Civil Lines Branch"],
  },
  Kochi: {
    state: "Kerala",
    branches: ["Main Branch", "MG Road Branch", "Kadavanthra Branch"],
  },
  Kolkata: {
    state: "West Bengal",
    branches: ["Main Branch", "Park Street Branch", "Salt Lake Branch", "Howrah Branch"],
  },
  Lucknow: {
    state: "Uttar Pradesh",
    branches: ["Main Branch", "Hazratganj Branch", "Gomti Nagar Branch"],
  },
  Ludhiana: {
    state: "Punjab",
    branches: ["Main Branch", "Model Town Branch", "Sarabha Nagar Branch"],
  },
  Madurai: {
    state: "Tamil Nadu",
    branches: ["Main Branch", "KK Nagar Branch", "Anna Nagar Branch"],
  },
  Mumbai: {
    state: "Maharashtra",
    branches: ["Main Branch", "Andheri Branch", "Borivali Branch", "Bandra Branch", "Dadar Branch"],
  },
  Mysore: {
    state: "Karnataka",
    branches: ["Main Branch", "Vontikoppal Branch", "Gokulam Branch"],
  },
  Nagpur: {
    state: "Maharashtra",
    branches: ["Main Branch", "Sitabuldi Branch", "Dharampeth Branch"],
  },
  Nashik: {
    state: "Maharashtra",
    branches: ["Main Branch", "College Road Branch", "Gangapur Road Branch"],
  },
  Noida: {
    state: "Uttar Pradesh",
    branches: ["Main Branch", "Sector 18 Branch", "Sector 62 Branch", "Greater Noida Branch"],
  },
  Patna: {
    state: "Bihar",
    branches: ["Main Branch", "Boring Road Branch", "Kankarbagh Branch"],
  },
  Pune: {
    state: "Maharashtra",
    branches: ["Main Branch", "Koregaon Park Branch", "Kothrud Branch", "Wakad Branch"],
  },
  Raipur: {
    state: "Chhattisgarh",
    branches: ["Main Branch", "Pandri Branch", "Devendra Nagar Branch"],
  },
  Ramgarh: {
    state: "Jharkhand",
    branches: ["Main Branch", "Cantt Branch", "Ramgarh Branch"],
  },
  "Ramgarh Cantt": {
    state: "Jharkhand",
    branches: ["Main Branch", "Cantt Branch", "Ramgarh Branch"],
  },
  Ranchi: {
    state: "Jharkhand",
    branches: ["Main Branch", "Lalpur Branch", "Hinoo Branch"],
  },
  Jamshedpur: {
    state: "Jharkhand",
    branches: ["Main Branch", "Bistupur Branch", "Sakchi Branch"],
  },
  Dhanbad: {
    state: "Jharkhand",
    branches: ["Main Branch", "Bank More Branch", "Saraidhela Branch"],
  },
  Surat: {
    state: "Gujarat",
    branches: ["Main Branch", "Ring Road Branch", "Adajan Branch"],
  },
  Thane: {
    state: "Maharashtra",
    branches: ["Main Branch", "Naupada Branch", "Wagle Estate Branch"],
  },
  Thiruvananthapuram: {
    state: "Kerala",
    branches: ["Main Branch", "MG Road Branch", "Kowdiar Branch"],
  },
  Vadodara: {
    state: "Gujarat",
    branches: ["Main Branch", "Alkapuri Branch", "Fatehgunj Branch"],
  },
  Varanasi: {
    state: "Uttar Pradesh",
    branches: ["Main Branch", "Lahurabir Branch", "Sigra Branch"],
  },
  Vijayawada: {
    state: "Andhra Pradesh",
    branches: ["Main Branch", "Governorpet Branch", "Labbipet Branch"],
  },
  Visakhapatnam: {
    state: "Andhra Pradesh",
    branches: ["Main Branch", "Dwaraka Nagar Branch", "MVP Colony Branch"],
  },
}

export const INDIAN_CITY_TO_STATE_MAP: Record<string, string> = {
  // Andhra Pradesh
  visakhapatnam: "Andhra Pradesh", vizag: "Andhra Pradesh", vijayawada: "Andhra Pradesh", guntur: "Andhra Pradesh", nellore: "Andhra Pradesh", kurnool: "Andhra Pradesh", rajahmundry: "Andhra Pradesh", tirupati: "Andhra Pradesh", kakinada: "Andhra Pradesh", anantapur: "Andhra Pradesh",
  // Assam
  guwahati: "Assam", silchar: "Assam", dibrugarh: "Assam", jorhat: "Assam", nagaon: "Assam", tinsukia: "Assam", tezpur: "Assam",
  // Bihar
  patna: "Bihar", gaya: "Bihar", bhagalpur: "Bihar", muzaffarpur: "Bihar", purnia: "Bihar", darbhanga: "Bihar", arrah: "Bihar", begusarai: "Bihar",
  // Chandigarh
  chandigarh: "Chandigarh", mohali: "Punjab",
  // Chhattisgarh
  raipur: "Chhattisgarh", bhilai: "Chhattisgarh", bilaspur: "Chhattisgarh", korba: "Chhattisgarh", durg: "Chhattisgarh",
  // Delhi
  delhi: "Delhi", "new delhi": "Delhi",
  // Goa
  panaji: "Goa", margao: "Goa", "vasco da gama": "Goa", mapusa: "Goa",
  // Gujarat
  ahmedabad: "Gujarat", surat: "Gujarat", vadodara: "Gujarat", baroda: "Gujarat", rajkot: "Gujarat", bhavnagar: "Gujarat", jamnagar: "Gujarat", junagadh: "Gujarat", gandhinagar: "Gujarat", anand: "Gujarat", navsari: "Gujarat", morbi: "Gujarat",
  // Haryana
  gurugram: "Haryana", gurgaon: "Haryana", faridabad: "Haryana", panipat: "Haryana", ambala: "Haryana", yamunanagar: "Haryana", rohtak: "Haryana", hisar: "Haryana", karnal: "Haryana", sonipat: "Haryana", panchkula: "Haryana",
  // Himachal Pradesh
  shimla: "Himachal Pradesh", dharamshala: "Himachal Pradesh", solan: "Himachal Pradesh", mandi: "Himachal Pradesh", kullu: "Himachal Pradesh",
  // Jharkhand
  ranchi: "Jharkhand", jamshedpur: "Jharkhand", dhanbad: "Jharkhand", bokaro: "Jharkhand", ramgarh: "Jharkhand", "ramgarh cantt": "Jharkhand", deoghar: "Jharkhand", hazaribagh: "Jharkhand", giridih: "Jharkhand",
  // Karnataka
  bangalore: "Karnataka", bengaluru: "Karnataka", mysore: "Karnataka", mysuru: "Karnataka", hubli: "Karnataka", dharwad: "Karnataka", mangalore: "Karnataka", mangaluru: "Karnataka", belgaum: "Karnataka", belagavi: "Karnataka", gulbarga: "Karnataka", davangere: "Karnataka", bellary: "Karnataka", shimoga: "Karnataka", tumkur: "Karnataka",
  // Kerala
  thiruvananthapuram: "Kerala", trivandrum: "Kerala", kochi: "Kerala", cochin: "Kerala", kozhikode: "Kerala", calicut: "Kerala", thrissur: "Kerala", kollam: "Kerala", palakkad: "Kerala", alappuzha: "Kerala", kannur: "Kerala",
  // Madhya Pradesh
  bhopal: "Madhya Pradesh", indore: "Madhya Pradesh", jabalpur: "Madhya Pradesh", gwalior: "Madhya Pradesh", ujjain: "Madhya Pradesh", sagar: "Madhya Pradesh", dewas: "Madhya Pradesh", satna: "Madhya Pradesh", ratlam: "Madhya Pradesh", rewa: "Madhya Pradesh",
  // Maharashtra
  mumbai: "Maharashtra", pune: "Maharashtra", nagpur: "Maharashtra", thane: "Maharashtra", "pimpri chinchwad": "Maharashtra", nashik: "Maharashtra", nasik: "Maharashtra", kalyan: "Maharashtra", dombivli: "Maharashtra", vasai: "Maharashtra", virar: "Maharashtra", aurangabad: "Maharashtra", "chhatrapati sambhajinagar": "Maharashtra", solapur: "Maharashtra", bhiwandi: "Maharashtra", amravati: "Maharashtra", nanded: "Maharashtra", kolhapur: "Maharashtra", sangli: "Maharashtra", jalgaon: "Maharashtra", akola: "Maharashtra", "navi mumbai": "Maharashtra",
  // Odisha
  bhubaneswar: "Odisha", cuttack: "Odisha", rourkela: "Odisha", berhampur: "Odisha", sambalpur: "Odisha", puri: "Odisha", balasore: "Odisha",
  // Punjab
  ludhiana: "Punjab", amritsar: "Punjab", jalandhar: "Punjab", patiala: "Punjab", bathinda: "Punjab", pathankot: "Punjab", hoshiarpur: "Punjab",
  // Rajasthan
  jaipur: "Rajasthan", jodhpur: "Rajasthan", kota: "Rajasthan", bikaner: "Rajasthan", ajmer: "Rajasthan", udaipur: "Rajasthan", bhilwara: "Rajasthan", alwar: "Rajasthan", sikar: "Rajasthan", ganganagar: "Rajasthan",
  // Tamil Nadu
  chennai: "Tamil Nadu", coimbatore: "Tamil Nadu", madurai: "Tamil Nadu", tiruchirappalli: "Tamil Nadu", trichy: "Tamil Nadu", salem: "Tamil Nadu", tiruppur: "Tamil Nadu", erode: "Tamil Nadu", vellore: "Tamil Nadu", tirunelveli: "Tamil Nadu", thoothukudi: "Tamil Nadu", nagercoil: "Tamil Nadu",
  // Telangana
  hyderabad: "Telangana", warangal: "Telangana", nizamabad: "Telangana", karimnagar: "Telangana", ramagundam: "Telangana", khammam: "Telangana",
  // Uttar Pradesh
  lucknow: "Uttar Pradesh", kanpur: "Uttar Pradesh", ghaziabad: "Uttar Pradesh", agra: "Uttar Pradesh", varanasi: "Uttar Pradesh", meerut: "Uttar Pradesh", prayagraj: "Uttar Pradesh", allahabad: "Uttar Pradesh", bareilly: "Uttar Pradesh", aligarh: "Uttar Pradesh", moradabad: "Uttar Pradesh", saharanpur: "Uttar Pradesh", gorakhpur: "Uttar Pradesh", noida: "Uttar Pradesh", "greater noida": "Uttar Pradesh", jhansi: "Uttar Pradesh", muzaffarnagar: "Uttar Pradesh", mathura: "Uttar Pradesh", ayodhya: "Uttar Pradesh",
  // Uttarakhand
  dehradun: "Uttarakhand", haridwar: "Uttarakhand", roorkee: "Uttarakhand", haldwani: "Uttarakhand", rudrapur: "Uttarakhand", rishikesh: "Uttarakhand",
  // West Bengal
  kolkata: "West Bengal", asansol: "West Bengal", siliguri: "West Bengal", durgapur: "West Bengal", bardhaman: "West Bengal", malda: "West Bengal", baharampur: "West Bengal", kharagpur: "West Bengal", howrah: "West Bengal",
}

export function getStateForCity(cityName: string): string | null {
  if (!cityName) return null
  const cleaned = cityName.trim().toLowerCase()
  if (INDIAN_CITY_TO_STATE_MAP[cleaned]) {
    return INDIAN_CITY_TO_STATE_MAP[cleaned]
  }
  const foundKey = Object.keys(INDIAN_CITY_TO_STATE_MAP).find(key => cleaned.includes(key) || key.includes(cleaned))
  if (foundKey) {
    return INDIAN_CITY_TO_STATE_MAP[foundKey]
  }
  return null
}

export const CITIES = Object.keys(BRANCH_LOCATIONS).sort()
