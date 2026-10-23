# Data Sources and Data Rights Notes

The MIT License in this repository applies to dGC-JP code and documentation. It does not independently grant rights in third-party publications, growth-reference values, or other source material.

## Height and Weight LMS Reference

- **Source**: Isojima et al., *Clin Pediatr Endocrinol.* 2016;25:71-76. DOI: [10.1297/cpe.25.71](https://doi.org/10.1297/cpe.25.71). The implementation identifies this reference as based on the 2000 MHLW national survey.
- **Used in dGC-JP**: Age-indexed height and weight LMS values for SDS calculations and chart reference curves.
- **Article/publication license**: The DOI resolves to the publisher/Crossref record. The publication license was not independently confirmed in this repository review.
- **Numerical-data redistribution**: The source values are implemented as application reference data. Permission to redistribute extracted numerical data is not inferred from the ability to access the article or its publication license alone.
- **Notes**: Licensing status for extracted numerical data should be independently confirmed with the relevant rightsholder or publisher.
- **Height LMS values**: `HEIGHT_BOYS_LMS` / `HEIGHT_GIRLS_LMS` hold the Table 2 L, M and S values as published (40 ages from 0 to 17.5 years per sex, negative L retained, boys 17.5 years L exactly 0, no re-estimation or extra rounding). Height L is no longer fixed at 1. They are used only for the height background curves, including the -2.5 SD and -3 SD lines, which are calculated by the same inverse LMS formula as the other lines and are not a reproduction of the society's former treatment-criteria lines. Height SDS does not use them. Values between table ages are produced by the application's interpolation, not by a continuous curve published with the article.
- **Height LMS verification**: Values were transcribed from an image of Table 2 supplied by the maintainer into `src/data/isojima-height-lms-source-fixture.ts` and compared cell by cell (240 cells) with the application data by a test. This confirms agreement between two transcriptions; it is not a re-verification against the printed article by a third party. Weight LMS values were not re-verified.
- **Weight SDS calculation age**: dGC-JP selects the completed month from the measurement date and applicable reference birth date, converts it to years by dividing by 12, and interpolates the existing LMS table at that age. The existing LMS interpolation and endpoint clamping are retained.
- **Spreadsheet comparison**: A user-provided report of comparison with a reference Excel workbook states that differences can arise from height-reference value precision, weight LMS reference-value generation methods and related details, and the definition of the fractional year used for decimal age. This application records that report; it did not independently re-analyze the workbook. No hidden-sheet values, coefficients, or formulas are reproduced here. The golden tests verify the calculation path against the current in-repository LMS values; for weight they do not establish that the LMS data itself has been checked against its original source.

## Monthly Height Reference (JSPE Attached Table 1)

- **Source**: [Japanese Society for Pediatric Endocrinology, Attached Table 1 PDF](https://jspe.umin.jp/medical/files/fuhyo1.pdf).
- **Used in dGC-JP**: Completed-month height means and standard deviations used for height SDS at all ages, for completed months 0 through 210 (17y6m). Height SDS = (height - mean for the completed month) / SD for the completed month, with no interpolation between months. Completed month 211 (17y7m) and later have no height SDS; the application does not fall back to LMS. Reference background curves and weight SDS use the LMS reference above, not this table.
- **Verification limit**: Tests compare calculations against the values currently held in `src/data/fuhyo-growth-data.ts` (hand-calculated examples). Row-by-row verification of this table against the original Attached Table 1 PDF was not performed in this change, and the reference values were not modified.
- **Article/publication license**: This is an official publicly available society document. A separate reuse or redistribution license was not confirmed in this repository review.
- **Numerical-data redistribution**: The tabulated values are implemented as application reference data; public availability of the PDF does not by itself establish redistribution rights for extracted data.
- **Notes**: Confirm reuse conditions with the Japanese Society for Pediatric Endocrinology before relying on redistribution permission.

## Achondroplasia Height and Weight Reference (CLARITY, US cohort)

- **Source**: Hoover-Fong JE, Schulze KJ, Alade AY, et al. *Growth in achondroplasia including stature, weight, weight-for-height and head circumference from CLARITY: achondroplasia natural history study - a multi-center retrospective cohort study of achondroplasia in the US.* *Orphanet J Rare Dis.* 2021;16:522. DOI: [10.1186/s13023-021-02141-4](https://doi.org/10.1186/s13023-021-02141-4).
- **File used**: Additional file 2 (Table S1), `13023_2021_2141_MOESM2_ESM.csv`. URL: `https://media.springernature.com/original/springer-static/esm/art%3A10.1186%2Fs13023-021-02141-4/MediaObjects/13023_2021_2141_MOESM2_ESM.csv`. Retrieved 2026-10-23. SHA-256 of the original file: `9cbe7ca560fabf0722792a2100e7afc1af1dc6dc34882302e1b5bdd069fe5e6c`.
- **Used in dGC-JP** (selectable alternative to the Japanese reference; the Japanese references above are unchanged): Columns `Sex (M=0, F = 1)`, `age (months)`, `ht mean`, `htsd`, `wt_mean`, `wt sd lower`, `wt sd upper`, for completed months 0 through 216 (18.0 years), 217 rows per sex, in `src/data/achondroplasia-clarity-data.ts`. Values are copied as the CSV text with no re-rounding or manual correction. The other columns (including `ht sd lower/upper`, `wt_sd`, head circumference, sample sizes) are not used.
- **Nature of the reference**: Mean and SD by completed month. It is **not an LMS table**, and no pseudo-LMS values are derived from it. The cohort is US (CLARITY) achondroplasia; it is not a Japanese achondroplasia reference.
- **Calculation (application specification)**: Height SDS = (height - `ht mean`) / `htsd` (a common SD). The use of the common height SD is the application's adopted specification; this repository does not claim that the paper specifies it. Weight SDS uses `wt sd upper` when weight is above `wt_mean`, `wt sd lower` when weight is at or below `wt_mean` (0 when equal, provided the lower SD is usable), following the paper's Methods ("Analysis"). The row is the completed month from the reference birth date to the measurement date (`differenceInMonths`), with no interpolation inside a month and no use of the last row beyond 18.0 years; ages above exactly 18.0 years are out of range and give no SDS.
- **Corrected age**: The existing application policy (correction applied through exactly 3.0 years, evaluation held before the 40w0d-equivalent date or for invalid gestational information) is applied unchanged. This is the application's policy; it is not validated by the paper, and the paper excluded data of preterm infants under 2 years from its reference.
- **Background lines**: SD lines are computed from the same columns (height: mean + z x `htsd`; weight: mean + z x upper SD for z > 0, mean + z x lower SD for z < 0), joined with straight lines between completed-month points. They are not a reproduction of the paper's percentile curves.
- **Wording discrepancy**: The article's additional-file list describes Table S1 as "by month from birth through 20 years" (the CSV has months 0-239 per sex), while the application specification limits use to 0 through 18.0 years (216 completed months). Rows for months 217-239 are not used.
- **Verification performed (mechanical)**: `scripts/generate-achondroplasia-clarity-data.ts` produces the data file from the original CSV. `scripts/achondroplasia-clarity-independent-check.ts` (its own CSV parser, no import of calculation code) checked the CSV structure (sex codes 0/1, 240 rows per sex with months 0-239, no gaps or duplicates, finite values, positive SDs) and reconciled all 2,170 used cells (217 rows x 5 columns x 2 sexes) and the SHA-256 against the data file. `src/data/achondroplasia-clarity-source-fixture.ts` (generated from the original CSV) lets `src/data/achondroplasia-clarity-data.test.ts` repeat the cell-by-cell comparison. This is a mechanical match with the file as retrieved; it is not a human visual check that the correct file or columns were chosen, and it does not assess clinical validity.

**Article/publication license**: The article is published under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution to Hoover-Fong et al., the article DOI, and the source-file URL are retained.

- **Numerical-data reuse**: The article's “Rights and permissions” section states that [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) applies to the data made available in the article unless otherwise stated in a credit line to the data. Additional file 2 (Table S1) is published as the article's supplementary CSV, and its listing contains no separate restriction. dGC-JP relies on this statement to reuse its numerical data. The selected rows and columns are converted to TypeScript without re-rounding or numerical correction; the extraction and application-specific calculations are documented above.

## Preterm Reference-Range Policy

- dGC-JP currently does not include a preterm-specific reference dataset for measurements before the 40w0d-equivalent date.
- This application does not substitute a non-Japanese preterm standard during that period.
- Standard height and weight SDS evaluation therefore begins at the 40w0d-equivalent date using corrected age 0.

## Height Velocity Reference

- **Source**: Suwa S, Tachibana K, Maesaka H, Tanaka T, Yokoya S. *Longitudinal Standards for Height and Height Velocity for Japanese Children from Birth to Maturity.* *Clin Pediatr Endocrinol.* 1992;1(1):5-13. DOI: [10.1297/cpe.1.5](https://doi.org/10.1297/cpe.1.5).
- **Used in dGC-JP**: The `height velocity (cm/yr)` mean and SD columns of Table 3 (boys, journal p.10) and Table 4 (girls, journal p.11), in 0.25-year steps (boys 0-17.5 years, 71 rows; girls 0-17.25 years, 70 rows), for Suwa HV-SDS calculations. Source ages are printed as `yr-mo` and converted as years + months/12 (13-3 = 13.25 years).
- **Missing values**: The source prints "—" for the mean at 0-0 and 0-3 and for the SD at 0-0 through 0-9, in both tables. dGC-JP holds these as missing (`null`), not 0, and does not calculate HV-SDS where the reference SD is missing (a midpoint age below 1.0 years). The Suwa HV in cm/year is still shown.
- **Verification performed**: Every mean and SD cell of both tables is compared with a transcription of the source page images (`src/data/suwa-hv-source-fixture.ts`) by an automated test (`src/data/suwa-hv-reference.test.ts`); see `docs/suwa-hv-reference-audit.md`. The transcription was made by an AI agent and is not an independent human double entry. This check covers the Suwa height-velocity table only and does not extend to the other reference datasets listed here.
- **Article/publication license**: The DOI resolves to a publication record. The article license and reuse terms were not independently confirmed in this repository review.
- **Numerical-data redistribution**: The source values are implemented as application reference data. The article's availability or publication license alone is not treated as confirmation that extracted numerical data may be redistributed. The source PDF is not included in this repository.
- **Notes**: Licensing status for the numerical reference values should be independently confirmed.

## Obesity Index Formulae

- **Source**: *Clin Pediatr Endocrinol.* 2016;25:77-82. DOI: [10.1297/cpe.25.77](https://doi.org/10.1297/cpe.25.77). The implementation also identifies JSPE/Japanese Ministry of Health and Welfare pediatric standard-weight equations as its source basis.
- **Used in dGC-JP**: Height- and age-based standard-weight equations used to calculate the obesity index.
- **Article/publication license**: The DOI resolves to the publisher/Crossref record. The publication license was not independently confirmed in this repository review.
- **Numerical-data redistribution**: dGC-JP implements formulae rather than a separate source table. Any rights or reuse requirements for the published equations should be independently confirmed.
- **Notes**: Citation and public availability do not themselves determine reuse rights.
