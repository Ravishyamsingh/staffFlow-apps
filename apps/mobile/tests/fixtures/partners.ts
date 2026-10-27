import type { Partner } from "../../src/domain/types";

export const TEST_PARTNERS: Partner[] = [
  { id: "p-1", name: "Rajesh Kumar", role: "chef", subcategories: ["Chinese Chef", "General Chef"], area: "CP Outer Circle", distanceKm: 1.4, reliability: 4.9, shiftsCompleted: 142, availability: ["Sat", "Sun"], verified: true },
  { id: "p-2", name: "Amit Sharma", role: "chef", subcategories: ["Chinese Chef", "Tandoor Chef"], area: "Barakhamba", distanceKm: 2.1, reliability: 4.8, shiftsCompleted: 118, availability: ["Fri", "Sat", "Sun"], verified: true },
  { id: "p-3", name: "Suresh Thapa", role: "chef", subcategories: ["Pan-Asian Chef", "Chinese Chef"], area: "Janpath", distanceKm: 3.2, reliability: 4.7, shiftsCompleted: 94, availability: ["Sat"], verified: true },
  { id: "p-4", name: "Manoj Rawat", role: "chef", subcategories: ["Chinese Chef", "Pastry Chef"], area: "Paharganj", distanceKm: 3.8, reliability: 4.6, shiftsCompleted: 87, availability: ["Sat", "Sun"] },
  { id: "p-5", name: "Sunil Prasad", role: "helper", subcategories: ["Kitchen Helper", "Station Cook"], area: "Bengali Market", distanceKm: 4.5, reliability: 4.5, shiftsCompleted: 64, availability: ["Sat", "Sun"] },
  { id: "p-6", name: "Vikram Singh", role: "chef", subcategories: ["Tandoor Chef"], area: "Rajouri Garden", distanceKm: 1.9, reliability: 4.8, shiftsCompleted: 110, availability: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
  { id: "p-7", name: "Neeraj Malik", role: "chef", subcategories: ["Tandoor Chef"], area: "Punjabi Bagh", distanceKm: 2.7, reliability: 4.5, shiftsCompleted: 72, availability: ["Sat", "Sun"] },
  { id: "p-8", name: "Farah Khan", role: "chef", subcategories: ["Pastry Chef", "General Chef"], area: "Lajpat Nagar", distanceKm: 2.2, reliability: 4.9, shiftsCompleted: 136, availability: ["Fri", "Sat"] },
  { id: "p-9", name: "Meena Joshi", role: "cleaner", subcategories: ["Deep Cleaning"], area: "Pitampura", distanceKm: 1.2, reliability: 4.7, shiftsCompleted: 90, availability: ["Sat", "Sun"], verified: true },
  { id: "p-10", name: "Pooja Yadav", role: "cleaner", subcategories: ["Kitchen Utility", "Deep Cleaning"], area: "Rohini", distanceKm: 3.6, reliability: 4.4, shiftsCompleted: 58, availability: ["Sun"] },
  { id: "p-11", name: "Ritu Verma", role: "waiter", subcategories: ["Waiter", "Banquet Server"], area: "Karol Bagh", distanceKm: 1.7, reliability: 4.8, shiftsCompleted: 121, availability: ["Wed", "Thu", "Fri", "Sat"] },
  { id: "p-12", name: "Imran Ali", role: "waiter", subcategories: ["Waiter"], area: "Rajendra Place", distanceKm: 2.8, reliability: 4.6, shiftsCompleted: 83, availability: ["Sat", "Sun"] },
  { id: "p-13", name: "Karan Bedi", role: "waiter", subcategories: ["Banquet Server"], area: "Saket", distanceKm: 1.5, reliability: 4.5, shiftsCompleted: 77, availability: ["Fri", "Sat", "Sun"] },
  { id: "p-14", name: "Deepak Chauhan", role: "helper", subcategories: ["Kitchen Helper", "Utility & Dish Support"], area: "Saket", distanceKm: 1.1, reliability: 4.6, shiftsCompleted: 79, availability: ["Sat", "Sun"] },
  { id: "p-15", name: "Arjun Das", role: "helper", subcategories: ["Kitchen Helper"], area: "Hauz Khas", distanceKm: 2.6, reliability: 4.4, shiftsCompleted: 55, availability: ["Sat"] },
  { id: "p-16", name: "Nisha Kapoor", role: "chef", subcategories: ["Mughlai Chef", "General Chef"], area: "Hauz Khas", distanceKm: 2.4, reliability: 4.8, shiftsCompleted: 102, availability: ["Fri", "Sat"] },
  { id: "p-17", name: "Rakesh Pal", role: "chef", subcategories: ["Chinese Chef"], area: "Saket", distanceKm: 5.4, reliability: 4.3, shiftsCompleted: 41, availability: ["Sat", "Sun"] },
  { id: "p-18", name: "Asha Nair", role: "cleaner", subcategories: ["Kitchen Utility"], area: "Connaught Place", distanceKm: 1.6, reliability: 4.9, shiftsCompleted: 148, availability: ["Sat", "Sun"], verified: true },
  { id: "p-19", name: "Mohan Lal", role: "chef", subcategories: ["Chinese Chef", "Tandoor Chef"], area: "Karol Bagh", distanceKm: 4.2, reliability: 4.4, shiftsCompleted: 63, availability: ["Sat"] },
  { id: "p-20", name: "Shalini Roy", role: "other", subcategories: ["Station Cook"], area: "Defence Colony", distanceKm: 3.9, reliability: 4.6, shiftsCompleted: 69, availability: ["Fri", "Sat", "Sun"] },
];
