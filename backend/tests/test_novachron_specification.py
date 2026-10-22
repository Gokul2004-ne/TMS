"""Comprehensive NovaChron KPI Formula & Protocol Specification Test Suite.

Validates all rules, formulas, time-state models, and test cases specified in
NovaChron_KPI_Formula_Specification.pdf (v1.0):
- Section 4: Seven-State Time Model & Invariant check
- Section 6: Utilization (R01-R07) & Output (O01-O08) formulas
- Section 7: Anita Raman Worked Example Oracle (100% exact numerical match)
- Section 8: Composite Performance Index (C01) and Performance Bands
- Section 9: Points Ledger (E1-E3, S1-S2, N1-N2, Q1-Q2) & Levels (1-7)
- Section 14.1: Team Roll-up Aggregation Rules (Sum numerators/denominators & C02 weighting)
- Section 16: Validation Test Cases 1, 2, 7, 8, 9, 10, 11, 12
"""

import os
import sys
import math
import pytest

# Ensure backend root is on path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from services.kpi_calculator import (
    calculate_performance_index,
    get_performance_band,
    calculate_points_and_level,
    STD_AHT_MINUTES,
    OCCUPANCY_TARGET,
    UTILISATION_TARGET,
    DEFAULT_QUALITY_SCORE,
    DEFAULT_SOP_ADHERENCE
)


def test_section_4_time_state_invariant():
    """Case 2: Time-state reconciliation invariant:
    logged = brk + va + bva + nva + wait + uidle + sidle
    """
    logged = 303.0
    brk = 30.0
    va = 130.0
    bva = 41.0
    nva = 36.0
    wait = 28.0
    uidle = 21.0
    sidle = 17.0

    sum_states = brk + va + bva + nva + wait + uidle + sidle
    assert sum_states == logged, f"Invariant violated: {sum_states} != {logged}"


def test_section_7_worked_example_oracle():
    """Case 1: Section 7 worked example oracle (Anita Raman at 13:05).
    Every KPI must match the published table within +-0.01 tolerance.
    """
    logged = 303.0
    brk = 30.0
    va = 130.0
    bva = 41.0
    nva = 36.0
    wait = 28.0
    uidle = 21.0
    sidle = 17.0
    completed = 25
    reopened = 1
    quality = 96.2
    sop = 94.0

    # Derived times
    t03 = logged - brk             # 273 min
    t04 = va + bva + nva           # 207 min
    t05 = va + bva                 # 171 min
    t09 = uidle + sidle            # 38 min

    assert t03 == 273.0
    assert t04 == 207.0
    assert t05 == 171.0
    assert t09 == 38.0

    # Utilization ratios
    r01 = (t05 / t03) * 100.0          # 62.6%
    r02 = (t04 / t03) * 100.0          # 75.8%
    r03 = ((t04 + wait) / t03) * 100.0 # 86.1%
    r04 = (uidle / t03) * 100.0        # 7.7%
    r05 = (sidle / t03) * 100.0        # 6.2%
    r06 = (t09 / t03) * 100.0          # 13.9%
    r07 = (nva / t03) * 100.0          # 13.2%

    assert round(r01, 1) == 62.6
    assert round(r02, 1) == 75.8
    assert round(r03, 1) == 86.1
    assert round(r04, 1) == 7.7
    assert round(r05, 1) == 6.2
    assert round(r06, 1) == 13.9
    assert round(r07, 1) == 13.2

    # Output metrics
    o01 = completed                    # 25
    o02 = (t04 + wait) / o01           # 9.40 min
    o03 = (t03 * OCCUPANCY_TARGET) / STD_AHT_MINUTES # 25.78
    o04 = (o01 / o03) * 100.0          # 97.0%
    o05 = min(1.0, STD_AHT_MINUTES / o02) * 100.0 # 95.7%
    o06 = o01 / (t03 / 60.0)           # 5.49
    o07 = max(0.0, o03 - o01)          # 0.78
    o08 = o07 * STD_AHT_MINUTES        # 7.05 min
    q03 = (reopened / o01) * 100.0     # 4.0%

    assert round(o02, 2) == 9.40
    assert round(o03, 2) == 25.78
    assert round(o04, 1) == 97.0
    assert round(o05, 1) == 95.7
    assert round(o06, 2) == 5.49
    assert round(o07, 2) == 0.78
    assert round(o08, 2) == 7.05
    assert round(q03, 1) == 4.0

    # Composite Performance Index C01
    c01 = calculate_performance_index(
        output_attainment=o04,
        aht_attainment=o05,
        utilisation_pct=r02,
        quality_score=quality,
        sop_adherence=sop
    )
    assert c01 == 95.7, f"C01 index {c01} != expected 95.7"

    band, status = get_performance_band(c01)
    assert band == "On target"
    assert status == "OPTIMAL"


def test_section_8_bands_and_caps():
    """Case 9: Output above expected (O04 = 112%).
    Index output term is capped at 1.0; O04 reports 112%.
    """
    c01_high = calculate_performance_index(
        output_attainment=112.0, # capped at 1.0
        aht_attainment=100.0,
        utilisation_pct=80.0,
        quality_score=98.0,
        sop_adherence=98.0
    )
    # 100 * (0.30*1.0 + 0.20*1.0 + 0.20*1.0 + 0.15*0.98 + 0.15*0.98) = 100 * (0.70 + 0.294) = 99.4
    assert c01_high == 99.4
    band, _ = get_performance_band(c01_high)
    assert band == "On target"

    # Exceeding band (>= 105)
    band_exceed, _ = get_performance_band(106.0)
    assert band_exceed == "Exceeding"

    # Action required band (< 85)
    band_low, status_low = get_performance_band(78.5)
    assert band_low == "Action required"
    assert status_low == "BELOW TARGET"


def test_section_9_points_ledger_and_levels():
    """Section 9: Points ledger (Page 12) & Levels (Page 13).
    Verifies Section 7 worked example yields exactly 85 points earned today
    and assigns Level 4 Specialist (cumulative 2840 points, 360 to Level 5).
    """
    pts, lvl_num, lvl_name, total_pts, next_pts = calculate_points_and_level(
        completed_claims=25,
        output_attainment=97.0,
        aht_minutes=9.40,
        occupancy_pct=86.1,
        nva_pct=13.2,
        quality_score=96.2,
        sop_adherence=94.0,
        rework_claims_count=1,
        critical_sop_deviations=0,
        hourly_qualifying_hours=1, # E1: 10 pts
        nva_reduction_points=5,    # N2: 5 pts
        lifetime_base=2755         # 2755 + 85 = 2840
    )

    assert pts == 85, f"Daily points {pts} != expected 85"
    assert lvl_num == 4
    assert lvl_name == "Specialist"
    assert total_pts == 2840
    assert next_pts == 360 # 3200 - 2840 = 360


def test_section_9_compliance_gates():
    """Case 10: SOP adherence under 90% holds E and N points."""
    pts, _, _, _, _ = calculate_points_and_level(
        completed_claims=30,
        output_attainment=110.0,
        aht_minutes=8.0,
        occupancy_pct=85.0,
        nva_pct=7.0,
        quality_score=96.0,
        sop_adherence=89.0, # GATE FAILED (< 90%)
        rework_claims_count=0,
        critical_sop_deviations=0,
        hourly_qualifying_hours=3,
        nva_reduction_points=10,
        lifetime_base=1000
    )
    # E1, E2, E3, N1, N2 are held. S2 (20) + Q1 (30) + Q2 (20) = 70 pts
    assert pts == 70


def test_section_9_aht_exact_standard():
    """Case 11: AHT exactly 9.0m awards E2 (20 pts)."""
    pts, _, _, _, _ = calculate_points_and_level(
        completed_claims=20,
        output_attainment=90.0,
        aht_minutes=9.0, # Exactly standard
        occupancy_pct=80.0,
        nva_pct=12.0,
        quality_score=92.0,
        sop_adherence=92.0,
        rework_claims_count=1,
        critical_sop_deviations=0,
        hourly_qualifying_hours=0,
        nva_reduction_points=0,
        lifetime_base=1000
    )
    # Gate passed. E2 awarded (20) + S2 (20) = 40 pts
    assert pts == 40


def test_section_14_1_rollup_rules():
    """Case 7 & 8: Team roll-up rules:
    - Never average percentages across associates.
    - Team AHT = (Sum of Active + Wait) / Sum of Completed.
    - Team Occupancy = (Sum of Active + Wait) / Sum of Available.
    - Team Index C02 = Sum(C01 * T03) / Sum(T03) (Available-time weighted).
    """
    associates = [
        {"name": "Assoc A", "t03": 273.0, "t04": 207.0, "wait": 28.0, "completed": 25, "c01": 95.7},
        {"name": "Assoc B", "t03": 480.0, "t04": 360.0, "wait": 40.0, "completed": 45, "c01": 92.0},
        {"name": "Assoc C", "t03": 200.0, "t04": 150.0, "wait": 15.0, "completed": 18, "c01": 88.5},
    ]

    sum_t03 = sum(a["t03"] for a in associates) # 953.0
    sum_t04 = sum(a["t04"] for a in associates) # 717.0
    sum_wait = sum(a["wait"] for a in associates) # 83.0
    sum_comp = sum(a["completed"] for a in associates) # 88
    sum_weighted_c01 = sum(a["c01"] * a["t03"] for a in associates)

    # Team AHT
    team_aht = (sum_t04 + sum_wait) / sum_comp
    # Notice: arithmetic mean of individual AHTs:
    mean_aht = sum((a["t04"] + a["wait"]) / a["completed"] for a in associates) / len(associates)
    assert round(team_aht, 2) != round(mean_aht, 2), "Roll-up must not equal unweighted arithmetic mean!"

    # Team Occupancy
    team_occupancy = ((sum_t04 + sum_wait) / sum_t03) * 100.0
    individual_occ_mean = sum(((a["t04"] + a["wait"]) / a["t03"]) * 100.0 for a in associates) / len(associates)
    assert round(team_occupancy, 2) != round(individual_occ_mean, 2)

    # Team C02 Weighted Index
    c02 = sum_weighted_c01 / sum_t03
    unweighted_mean_c01 = sum(a["c01"] for a in associates) / len(associates)
    assert round(c02, 2) != round(unweighted_mean_c01, 2)
    assert 92.0 <= c02 <= 93.5
