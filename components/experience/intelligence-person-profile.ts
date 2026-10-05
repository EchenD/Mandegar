import type { Locale } from "@/lib/i18n";

// Authored character records belong to the scene, independent of visitor input.
const people = [
  { age: 24, gender: 0, interest: 0, expression: 0 },
  { age: 31, gender: 1, interest: 1, expression: 1 },
  { age: 28, gender: 0, interest: 2, expression: 2 },
  { age: 37, gender: 1, interest: 1, expression: 0 },
  { age: 22, gender: 0, interest: 0, expression: 1 },
] as const;
const labels = {
  en: { title: "Audience insight", age: "Age", gender: "Gender", interest: "Interested in", expression: "Expression", years: "years", genders: ["Male", "Female"], interests: ["Racing", "Design", "Photography"], expressions: ["Happy", "Curious", "Focused"] },
  fa: { title: "شناخت مخاطب", age: "سن", gender: "جنسیت", interest: "علاقه‌مند به", expression: "حالت چهره", years: "سال", genders: ["مرد", "زن"], interests: ["مسابقه", "طراحی", "عکاسی"], expressions: ["شاد", "کنجکاو", "متمرکز"] },
  ar: { title: "فهم الجمهور", age: "العمر", gender: "الجنس", interest: "مهتم بـ", expression: "التعبير", years: "عامًا", genders: ["رجل", "امرأة"], interests: ["السباق", "التصميم", "التصوير"], expressions: ["سعيد", "فضولي", "مركّز"] },
} as const;
export function getIntelligencePersonProfile(id: string, locale: Locale) {
  const index = Number(id.replace("Human_", ""));
  const person = people[(Number.isFinite(index) ? Math.abs(index) : 0) % people.length];
  const copy = labels[locale];
  const age = new Intl.NumberFormat(locale).format(person.age);
  return { copy, age, gender: copy.genders[person.gender], interest: copy.interests[person.interest], expression: copy.expressions[person.expression],
    lines: [`${copy.genders[person.gender]} · ${age} ${copy.years}`, `${copy.interest} · ${copy.interests[person.interest]}`, `${copy.expression} · ${copy.expressions[person.expression]}`] };
}
