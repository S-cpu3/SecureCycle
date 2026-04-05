**Calculations/Prediction Algorithm**

*The following list is from a privacy based period Tracking app Peri -- good stuff we can use as a checklist and baseline to cut out the noise of all the other factors :


-Calculating expected start date of the next period

-Current day of cycle

-How to calculate the day of ovulation

-Chance of getting pregnant

-Days Before Period 

-Calculation of the current phase 

___________________________________________________________________________________________________





*Research shows many similar apps are innaccurate due to the sheer number of factors that influence cycles. We need to consider all of the following in addition to the baseline.*

**INPUTS NEEDED:**


* lastPeriodStart     → date of last period
* cycleLength         → personal avg OR population avg by age (see table)
* stdDev              → personal OR population std dev by age (see table)
* lutealPhase         → default 14 days 

**POPULATION AVERAGES BY AGE:**


* under 20            → 30.3 days

* 20–39               → 28.7 days

* 40–44               → 28.2 days

* 45–49               → 28.4 days

* 50+                 → 30.8 days

**CORE FORMULA (everything derived from this line):**



*predicted  =  lastPeriodStart + cycleLength*

**EVERYTHING ELSE:**

* earliest        =  predicted - stdDev
* latest          =  predicted + stdDev
* ovulation       =  predicted - 14
* fertile_start   =  predicted - 19        (14 + 5 days before ovulation)
* fertile_end     =  predicted - 13        (14 - 1 day after ovulation)
* pms_start       =  predicted - 7    
* confidence      =  100 - (stdDev × 10)   → floor at 0

**Blending personal data with population avg:**



weight     =  cycles_logged / 6          → caps at 1.0
estimate   =  (personal × weight) + (population × (1 - weight))

example: 3 cycles logged
→ (personal × 0.5) + (population × 0.5)

Source: 

        "Menstrual cycle length and variability differed considerably across the reproductive lifespan, 
        from under 20 to above 50 years old. People under 20 years old had menstrual cycles 30.3 days long on average, 
        1.6 days longer than the 28.7-day average for those 35 to 39 years old. People 40 to 44 and 45 to 49 years old 
        had shorter cycles, averaging 28.2 and 28.4 days, respectively. Those over 50 years old had longer cycles, 
        averaging 30.8 days." (How Cycles vary...)



*We will need population averages as a default for users who don't provide enough logs, can determine this by age without any other data
 
This is subject to complete change, just an idea of how we could do it -> ->

```js


//Expected Cycle length
//Age ranges map to average menstrual cycle length in days
//Greater Variability as age increases 


const CYCLE_LENGTH_BY_AGE = [
    { maxAge: 20, cycleLength: 30.3 },
    { maxAge: 40, cycleLength: 28.7 },  // 20-39 years
    { maxAge: 45, cycleLength: 28.2 },  // 40-44 years
    { maxAge: 50, cycleLength: 28.4 },  // 45-49 years
    { maxAge: Infinity, cycleLength: 30.8 }  // 50+ years
];

function getPopulationAvgCycleLength(age) {
    //Can't be younger than 8 
    if (age < 8) throw new Error('Age below minimum');
    // Validate input
    if (typeof age !== 'number' || age < 0 || !isFinite(age)) {
        throw new Error('Age must be a non-negative number');
    }
    
    // Find the appropriate age bracket
    const bracket = CYCLE_LENGTH_BY_AGE.find(b => age < b.maxAge);
    return bracket?.cycleLength ?? 28.7;  // Safe fallback
}

//Expected Standard Deviation
// Age-based standard deviation estimates for cycle length
const STDDEV_BY_AGE = [
    { maxAge: 20, stdDev: 5.0 },   // cycles still regulating
    { maxAge: 35, stdDev: 3.0 },   // most regular years
    { maxAge: 45, stdDev: 4.0 },   // subtle changes beginning
    { maxAge: 50, stdDev: 6.5 },   // perimenopause likely
    { maxAge: Infinity, stdDev: 8.0 } // significant irregularity expected
];

function getExpectedStdDev(age) {
    // Validate input (same rules as cycle length)
    if (typeof age !== 'number' || age < 0 || !isFinite(age)) {
        throw new Error('Age must be a non-negative number');
    }

    const bracket = STDDEV_BY_AGE.find(b => age < b.maxAge);
    return bracket?.stdDev ?? 3.0; // fallback to the most common value
}

```




___________________________________________________________________________________________________



*This is up for debate whether we include every possible condition but very important in improving accuracy* ->

**PCOS**


Problem:    cycles are long and highly irregular (21–90+ days)

Adjustment: widen std_dev, raise minimum cycle length floor

     cycle_length  =  max(personalAvg, 35)        → floor at 35, not 28

     std_dev       =  max(personalStdDev, 10)      → minimum 10 day spread

     confidence    =  max(0, 100 - stdDev × 10)   → will often be 0–30%


     earliest      =  predicted - std_dev

     latest        =  predicted + std_dev          → range will be very wide


     ovulation     =  UNRELIABLE — Can't display wto user without OPK/BBT confirmation
     fertile_window =  UNRELIABLE — Must warn user that it is unknown; further research to confirm 


**ENDOMETRIOSIS**



Problem:    cycles are often shorter and heavier, pain is disproportionate
Adjustment: shorten expected cycle slightly, extend period length expectation

* cycle_length  =  min(personalAvg, 27)         → cycles tend to run short
* period_length =  personalAvg + 2              → bleeding tends to run longer
* std_dev       =  max(personalStdDev, 4)       → moderately less predictable

predicted, ovulation, fertile_window → same formulas as baseline
pain scoring  →  weight cramping severity higher in symptom calculations


**PERIMENOPAUSE**



Problem:    cycle length becomes erratic, periods may skip entirely
Adjustment: widen std_dev significantly, skip prediction

std_dev       =  max(personalStdDev, 14)      → two week spread minimum
confidence    =  max(0, 100 - stdDev × 10)   → often 0%

if cyclesLogged > 3 AND any cycle_length > 60:

     flag  =  'skipped_cycle'

     predicted  =  lastPeriodStart + personalAvg  → still show, but caveat heavily

     ovulation     =  UNRELIABLE — no luteal phase during Perimenopause

     fertile_window =  suppress or show with strong warning of inaccuracy 


**ACROSS ALL THREE CONDITIONS**


    confidence    =  max(0, 100 - stdDev × 10)   → same formula, naturally collapses

    display rule  =  if confidence < 30, show a range of posssible dates to user — never a single date


*Elaborating on confidence formula:*

 confidence = max(0, 100 - stdDev × 10) -- 
 
 * Converts days of uncertainty into a 0–100 confidence score by penalizing 10 points for every day of standard deviation: 


        stdDev = 0  →  100 - (0  × 10)  =  100%   perfect predictability

        stdDev = 2  →  100 - (2  × 10)  =  80%    very regular cycle

        stdDev = 5  →  100 - (5  × 10)  =  50%    moderately irregular

        stdDev = 7  →  100 - (7  × 10)  =  30%    quite irregular

        stdDev = 10 →  100 - (10 × 10)  =  0%     unpredictable

        stdDev = 14 →  100 - (14 × 10)  =  -40%   → max(0) floors it at 0%


