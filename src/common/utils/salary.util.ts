export function findJustMonthlySalary(hourly_pay_rate: number): number {
  if(!hourly_pay_rate || hourly_pay_rate <= 0 || isNaN(hourly_pay_rate)) return 0;
  return Number(process.env.CANDIDATE_HOUR_PER_MONTH) * (hourly_pay_rate + Number(process.env.CANDIDATE_COST_PER_HOUR));
}


import { floorPriceBilingualDictionary } from "../dictionaries/floorPriceBilingual-dictionary";
import { floorPriceEnglishDictionary } from "../dictionaries/floorPriceEnglish-dictionary";

export function getMinFloorPrice(dict: Record<string, number>): number {
  return Math.min(...Object.values(dict));
}


export function findMonthlySalary(hourly_pay_rate: number, language: string , role: string): number {
  //console.log('Calculating salary for:', {hourly_pay_rate, language, role});
  //if(!hourly_pay_rate || hourly_pay_rate <= 0 || isNaN(hourly_pay_rate)) return 0;

  const averageSalary = Number(process.env.CANDIDATE_HOUR_PER_MONTH) * (hourly_pay_rate + Number(process.env.CANDIDATE_COST_PER_HOUR));

  //check if the averageSalary is fewer than the price from dictionary
  let floorPrice;
  if (language === 'Bilingual') {
    floorPrice = floorPriceBilingualDictionary[`${role}`];
  }else if (language === 'English') {
    floorPrice = floorPriceEnglishDictionary[`${role}`];
  }else{
    return averageSalary;
  }

  //get the minimum floor price for the language
  const minFloorPrice = language === 'Bilingual' 
  ? getMinFloorPrice(floorPriceBilingualDictionary) 
  : language === 'English' 
    ? getMinFloorPrice(floorPriceEnglishDictionary) 
    : 0;
  
  //return the minimun floor price if role is empty
  if (role === '') {
    return Math.round(minFloorPrice * 100) / 100;
  }

  if(floorPrice && averageSalary < floorPrice) {
    return floorPrice;
  }

  //round to 2 decimal places
  const roundedSalary = Math.round(averageSalary * 100) / 100;

  return roundedSalary;
}


export function findHourlyPerRate(salary: number): number {
  return salary / Number(process.env.CANDIDATE_HOUR_PER_MONTH) - Number(process.env.CANDIDATE_COST_PER_HOUR);
}

export function findHourlySalary(monthSalary: number, availability: string ): number {

  const hoursToBeCalculated = availability.trim().toLowerCase() === 'part-time' 
    ? Number(process.env.CANDIDATE_HOUR_PER_MONTH) / 2 
    : Number(process.env.CANDIDATE_HOUR_PER_MONTH);
  
  const roundedSalary = Math.round((monthSalary / hoursToBeCalculated) * 100) / 100;

  return roundedSalary ;
}
