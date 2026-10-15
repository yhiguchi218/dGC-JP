# Data Sources and Data Rights Notes

The MIT License in this repository applies to dGC-JP code and documentation. It does not independently grant rights in third-party publications, growth-reference values, or other source material.

## Height and Weight LMS Reference

- **Source**: Isojima et al., *Clin Pediatr Endocrinol.* 2016;25:71-76. DOI: [10.1297/cpe.25.71](https://doi.org/10.1297/cpe.25.71). The implementation identifies this reference as based on the 2000 MHLW national survey.
- **Used in dGC-JP**: Age-indexed height and weight LMS values for SDS calculations and chart reference curves.
- **Article/publication license**: The DOI resolves to the publisher/Crossref record. The publication license was not independently confirmed in this repository review.
- **Numerical-data redistribution**: The source values are implemented as application reference data. Permission to redistribute extracted numerical data is not inferred from the ability to access the article or its publication license alone.
- **Notes**: Licensing status for extracted numerical data should be independently confirmed with the relevant rightsholder or publisher.

## Monthly Height Reference (JSPE Attached Table 1)

- **Source**: [Japanese Society for Pediatric Endocrinology, Attached Table 1 PDF](https://jspe.umin.jp/medical/files/fuhyo1.pdf).
- **Used in dGC-JP**: Completed-month height means and standard deviations used for height SDS in the applicable early-childhood range.
- **Article/publication license**: This is an official publicly available society document. A separate reuse or redistribution license was not confirmed in this repository review.
- **Numerical-data redistribution**: The tabulated values are implemented as application reference data; public availability of the PDF does not by itself establish redistribution rights for extracted data.
- **Notes**: Confirm reuse conditions with the Japanese Society for Pediatric Endocrinology before relying on redistribution permission.

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
