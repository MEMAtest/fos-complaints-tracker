# FOS Complaints Data Import

## Quick Start

1. Place CSV files in data directories:
   - `../../data/closed-within-3-days/` 
   - `../../data/after-3-days/`
   - `../../data/upheld/`
   - `../../data/consumer-credit/`

2. Run imports:
   ```bash
   npm run import ../../data/closed-within-3-days closed_3_days
   npm run import ../../data/after-3-days after_3_days
   npm run import ../../data/upheld upheld
   npm run import ../../data/consumer-credit consumer_credit
   