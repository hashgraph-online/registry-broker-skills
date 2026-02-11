import { SKILL_JSON_URL, SKILL_URL } from '../config';

export function skill(json = false) {
  if (json) {
    console.log(SKILL_JSON_URL);
  } else {
    console.log(SKILL_URL);
  }
}

