
**User Profile (baseline data for predictions)**

  We need:

    - Date of birth / age
    - Timezone
    - Intention; Is user trying to conceive, avoid pregnancy, or just tracking
    - Birth control method (if any — affects predictions significantly)
    - Known conditions (PCOS, endometriosis, perimenopause - heard some other apps dont have this option)

_Intention, birth control method, health conditions should be in their own tables; these are expensive and vital to predictions_

*Health conditions should be their own table because a user can have multiple conditions, therefore code will be cleaner with tables split up as much as possible* 


**Cycle Log** 

  It is possible to include these variables on top of the existing schema or they could be derived from columns: 

   - cycle_length INT       
   - period_start_date DATE 
   - period_end_date DATE   
   - period_length INT 

  Would make querying cleaner if these columns were added, and we could just AVG(Cycle_length) instead of updating the difference between start_date and end_date


___________________________________________________________________________________________________

**User Entries**


We can assign weights to enum variables like symptom type:

```js 

// Storage 
symptom_type: ENUM('cramps', 'bloating', 'headache', 'fatigue', 'acne', 'breast_tenderness', 'mood_swings')
intensity: ENUM('mild', 'moderate', 'severe')

// Example of one way we could do numeric mapping on front 
const severityScore = { mild: 1, moderate: 2, severe: 3 }
const symptomWeight = {
  cramps: 1.0,
  headache: 0.8,
  fatigue: 0.7,
  bloating: 0.6,
  breast_tenderness: 0.6,
  acne: 0.4,
  mood_swings: 0.5
}

```




**Key Quotes from Articles:**

   - "Menstrual cycle length and variability differed considerably across the reproductive lifespan, from under 20 to above 50 years old. People under 20 years old had menstrual cycles 30.3 days long on average, 1.6 days longer than the 28.7-day average for those 35 to 39 years old. People 40 to 44 and 45 to 49 years old had shorter cycles, averaging 28.2 and 28.4 days, respectively. Those over 50 years old had longer cycles, averaging 30.8 days." _(How cycles Vary...)_




  - " In case of irregular periods, cycle calculation can become challenging, but it is not impossible. The steps might be a little different for patients with irregular cycles.


    Steps for irregular cycles:

    - Track the length of the cycle for at least a duration of 6 months.
    - Identify the shortest and longest cycles for a rough estimate.
    - Calculate the average length of a cycle for better analysis. " _(How to Calculate Period...)_




  - "Furthermore, 82% of women aged 18–44 report using medication compared to 68% of men in the same age group" _(Medication Use Among...)_



___________________________________________________________________________________________________

Notes 

* Must inform users that changes in their sleep, alcohol/drug consumption, BMI and medications may alter the accuracy of the BBT in predicting cycles accurately. Additionally, intake of certain vitamins, and deficiency of nutrients like iron, may impact outcomes as well. 


* Must take into account that many users will not record vital info in the daily log - especially BBT tests; we don't have to include this as a feature


* Allow users to forego daily logs--encourage them to do so for accuracy


* Users may enter incorrect info with things that are subjective, like symptoms or consistency/color of cervical mucus


* If a user only logs period start dates and nothing else, the engine should still work — use a wider confidence interval and rely on population defaults for timing. 


* Can explicitly tell the user "add BBT or ovulation tests to improve your fertile window accuracy" rather than silently giving them a less accurate prediction. -- or omit the need for BBT 

___________________________________________________________________________________________________



Research Links 

***For UX and extra considerations:***

- [Impacts of Contraceptives On Cycles...](https://pmc.ncbi.nlm.nih.gov/articles/PMC12563454/)

- [Period Tracker Apps-What Info They Give Women...](https://pmc.ncbi.nlm.nih.gov/articles/PMC8504278/)

- [Insights on Menstrual Cycle...](https://pmc.ncbi.nlm.nih.gov/articles/PMC7164578/)

- [At Home Testing Methods...](https://www.fertstert.org/article/S0015-0282(11)00002-1/fulltext)

- [Basal Body Temp](https://my.clevelandclinic.org/health/articles/21065-basal-body-temperature)

- [Medication Use Among...](https://pmc.ncbi.nlm.nih.gov/articles/PMC4933290/)

***Population Stats:***

- [How Cycles vary...](https://hsph.harvard.edu/research/apple-womens-health-study/study-updates/menstrual-cycles-today-how-menstrual-cycles-vary-by-age-weight-race-and-ethnicity/)



***For prediction algorithms:***

---

- [Peri App Calculations](https://github.com/IraSoro/peri/blob/master/info/CALCULATION.md)

- [Menstrudel App Table Creation Methods](https://github.com/J-shw/Menstrudel/blob/dev/app/lib/database/database_migrator.dart)  

- [Menstrudel Prediction Calculations](https://github.com/J-shw/Menstrudel/tree/bd2ce30ff890fa66c3cc4472d5e20bcb695dc111/app/lib/utils) 

- [Flo Period Calculator](https://flo.health/tools/period-calculator)

- [Fertility Calculator Website](https://womenshealth.gov/ovulation-calculator)

- [How to calculate Period...](https://www.indiraivf.com/blog/how-to-calculate-period-cycle)

- [Trying to Get Pregnant...](https://www.acog.org/womens-health/experts-and-stories/the-latest/trying-to-get-pregnant-heres-when-to-have-sex)

- [Pre Menstrual Syndrome](https://womenshealth.gov/menstrual-cycle/premenstrual-syndrome)

