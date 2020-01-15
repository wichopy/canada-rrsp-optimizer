$(document).ready(function() {

	window.calculatorYear = 2019; //2019

	// Change year popover
	// $('.js-change-year').each(function() {
	// 	new Tooltip(this, {
	// 		placement: 'bottom',
	// 		trigger: 'click',
	// 		title: $(this).data('tooltip'),
	// 		html: true
	// 	});
	// });

	// Calculator popovers
	$('#taxcalcfields [data-tooltip]').each(function() {
		new Tooltip(this, {
			placement: 'top',
			trigger: 'focus',
			title: $(this).data('tooltip')
		});
	});

	// AutoNumeric init
	AutoNumeric.multiple('#taxcalcfields input', {currencySymbol: '$ ', decimalPlaces : 0, maximumValue: '999999.99'});
	AutoNumeric.multiple('#taxcalcanswers .js-answer:not(.js-percent)', 0, {currencySymbol: '$ ', decimalPlaces : 0, minimumValue:'-999999.99'});
	AutoNumeric.multiple('#taxcalcanswers .js-answer.js-percent', 0, {currencySymbol: ' %', currencySymbolPlacement: 's', decimalPlaces : 2,  minimumValue:'-999999.99'});

	// French AutoNumeric formatting
	if (window.lang && window.lang === 'fr') {
		$('#taxcalcfields input, #taxcalcanswers .js-answer:not(.js-percent)').each(function() {
			AutoNumeric.getAutoNumericElement(this).update({digitGroupSeparator: ' ', decimalCharacter: ',', currencySymbol: ' $', currencySymbolPlacement: 's'});
		});
	}

	// Automatic province selection
	$.getJSON('https://app.simpletax.ca/geoip', function(data) {
		// Don't change province if already selected
		if ($('#fieldProvince').val() == '' && data.province) {
			$('#fieldProvince').val(data.province);
		}
	});

	// Calculator prototype
	function taxCalc(inputs) {
		// inputs
		inputs = inputs || {};
		this.prov = inputs.prov;
		this.income_a = inputs.income_emp + inputs.other_inc;
		this.income_emp = inputs.income_emp;
		this.income_se = inputs.income_se;
		this.c_g = inputs.c_g;
		this.e_div = inputs.e_div;
		this.i_div = inputs.i_div;
		this.tax_paid = inputs.tax_paid;
		this.rrsp_d = inputs.rrsp_d;

		// outputs
		this.tax = 0;
		this.f_tax = 0;
		this.p_tax = 0;
		this.refund = 0;
		this.emp_cpp_premiums = 0;
		this.se_cpp_premiums = 0;
		this.ei_premiums = 0;
		this.payroll_tax_credits = 0;
		this.can_emp_amt = 0;
		this.e_rate = 0;
		this.m_rate = 0;


		// Tax Credits & Deductions
		// ------------------------------------------------------
		//Canada Employment Amount
		this.can_emp_amt = Math.min(1222,this.income_emp + this.income_se); /*2019*/

		// CPP Premiums
		this.cpp_max = 57400; /*2019*/
		this.cpp_exemption = 3500; /*2019*/
		this.cppqpp_rate = (this.prov == 'QC') ? 0.111 : 0.102; /*2019*/
		this.total_income = this.income_emp + this.income_se;

		//Employment CPP Premiums; assume employer properly withheld premiums and takes exemption into account
		this.emp_cpp_premiums = (Math.max(0, Math.min(this.income_emp, this.cpp_max) - this.cpp_exemption) * this.cppqpp_rate) / 2;

		//SE CPP Premiums
		if (this.income_se > 0 && this.income_emp == 0){
			//if no employment income, just use SE income to do calc
			this.se_cpp_premiums = Math.max(0, Math.min(this.income_se, this.cpp_max) - this.cpp_exemption) * this.cppqpp_rate;
		} else if (this.income_se > 0 && this.income_emp > 0){
			this.se_cpp_premiums = Math.max(0, Math.min(this.total_income, this.cpp_max) - this.cpp_exemption) * this.cppqpp_rate;
			this.se_cpp_premiums = this.se_cpp_premiums - (this.emp_cpp_premiums * 2);
		}

		//EI Premiums  [TODO PPIP/QC Rates]
		this.ei_max = 53100; /*2019*/
		this.ei_rate = 0.0162; /*2019*/
		this.ei_premiums = Math.max(0, Math.min(this.income_emp, this.ei_max)) * this.ei_rate;

		//Payroll Deductions
		this.payroll_deductions = this.emp_cpp_premiums + this.ei_premiums;

		//Payroll Tax Credits
		this.payroll_tax_credits = this.emp_cpp_premiums + (this.se_cpp_premiums/2) + this.ei_premiums;

		//Taxabe dividends
		this.taxable_e_div = this.e_div * 1.38; /*2019*/
		this.taxable_i_div = this.i_div * 1.15; /*2019*/

		//Taxable Income
		// ------------------------------------------------------
		this.income = this.income_a + this.income_se + (this.taxable_e_div) + (this.taxable_i_div) + (this.c_g / 2) - this.rrsp_d - (this.se_cpp_premiums / 2);

		// Debugging
		// console.log("Canada Employment Amount: " + this.can_emp_amt);
		// console.log("CPP Premiums (Emp): " + this.emp_cpp_premiums);
		// console.log("CPP Premiums (SE): " + this.se_cpp_premiums);
		// console.log("EI Premiums: " + this.ei_premiums);
		// console.log("Taxable Income: " + this.income);
		// console.log("////////////////////////////////////");

		// Federal Tax
		// ------------------------------------------------------

		if (this.income <= 47630){ /*2019*/
			this.f_tax = this.income * 0.15;
			this.m_rate = 0.15;
		}
		else if (this.income <= 95259) { /*2019*/
			this.f_tax = (this.income - 47630) * 0.205 + 7145;
			this.m_rate = 0.205;
		}
		else if (this.income <= 147667) { /*2019*/
			this.f_tax = (this.income - 95259) * 0.26 + 16908;
			this.m_rate = 0.26;
		}
		else if (this.income <= 210371) { /*2019*/
			this.f_tax = (this.income - 147667) * 0.29 + 30535;
			this.m_rate = 0.29;
		}
		else{ /*2019*/
			this.f_tax = (this.income - 210371) * 0.33 + 48719;
			this.m_rate = 0.33;
		}

		this.f_tax = Math.max(this.f_tax - ((12069 + this.can_emp_amt + this.payroll_tax_credits) * 0.15), 0); /*2019*/
		this.f_tax = Math.max(this.f_tax - (this.taxable_e_div * 0.150198) - (this.taxable_i_div * 0.090301), 0); /*2019*/

		if (this.prov == 'QC'){
			this.f_tax = this.f_tax * 0.835;
			this.m_rate = this.m_rate * 0.835;
		}

		// Provincial Tax
		// ------------------------------------------------------

		switch (this.prov) {

			// Alberta
			case 'AB':
				if (this.income <= 131220) { /*2019*/
					this.p_tax = this.income * 0.1;
					this.m_rate = this.m_rate + 0.1;
				} else if (this.income <= 157464) { /*2019*/
					this.p_tax = (this.income - 131220) * 0.12 + 13122;
					this.m_rate = this.m_rate + 0.12;
				}  else if (this.income <= 209952) { /*2019*/
					this.p_tax = (this.income - 157464) * 0.13 + 16271;
					this.m_rate = this.m_rate + 0.13;
				}  else if (this.income <= 314928) { /*2019*/
					this.p_tax = (this.income - 209952) * 0.14 + 23095;
					this.m_rate = this.m_rate + 0.14;
				} else { /*2019*/
					this.p_tax = (this.income - 314928) * 0.15 + 37791;
					this.m_rate = this.m_rate + 0.15;
				}
				this.p_tax = Math.max(this.p_tax - ((19369 + this.payroll_tax_credits) * 0.10), 0); /*2019*/
				this.p_tax = Math.max(this.p_tax - (this.taxable_e_div * 0.10) - (this.taxable_i_div * 0.0204), 0); /*2019*/
				break;

			// British Columbia
			case 'BC':
				if (this.income <= 40707) { /*2019*/
					this.p_tax = this.income * 0.0506;
					this.m_rate = this.m_rate + 0.0506;
				} else if (this.income <= 81416) { /*2019*/
					this.p_tax = (this.income - 40707) * 0.077 + 2060;
					this.m_rate = this.m_rate + 0.077;
				} else if (this.income <= 93476) { /*2019*/
					this.p_tax = (this.income - 81416) * 0.105 + 5194;
					this.m_rate = this.m_rate + 0.105;
				} else if (this.income <= 113506) { /*2019*/
					this.p_tax = (this.income - 93476) * 0.1229 + 6461;
					this.m_rate = this.m_rate + 0.1229;
				}  else if (this.income <= 153900) { /*2019*/
					this.p_tax = (this.income - 113506) * 0.1470 + 8922;
					this.m_rate = this.m_rate + 0.1470;
				} else { /*2019*/
					this.p_tax = (this.income - 153900) * 0.1680 + 14860;
					this.m_rate = this.m_rate + 0.1680;
				}
				this.p_tax = Math.max(this.p_tax - ((10682 + this.payroll_tax_credits) * 0.0506), 0); /*2019*/
				this.p_tax = Math.max(this.p_tax - (this.taxable_e_div * 0.12) - (this.taxable_i_div * 0.0196), 0); /*2019*/
				break;

			// Manitoba
			case 'MB':
				if (this.income <= 32670) { /*2019*/
					this.p_tax = this.income * 0.108;
					this.m_rate = this.m_rate + 0.108;
				} else if (this.income <= 70610) { /*2019*/
					this.p_tax = (this.income - 32670) * 0.1275 + 3528;
					this.m_rate = this.m_rate + 0.1275;
				} else { /*2019*/
					this.p_tax = (this.income - 70610) * 0.174 + 8366;
					this.m_rate = this.m_rate + 0.174;
				}
				this.p_tax = Math.max(this.p_tax - ((9626 + this.payroll_tax_credits) * 0.108), 0); /*2019*/
				this.p_tax = Math.max(this.p_tax - (this.taxable_e_div * 0.08) - (this.taxable_i_div * 0.007835), 0); /*2019*/
				break;

			// New Brunswick
			case 'NB':
				if (this.income <= 42592) { /*2019*/
					this.p_tax = this.income * 0.0968;
					this.m_rate = this.m_rate + 0.0968;
				} else if (this.income <= 85184) { /*2019*/
					this.p_tax = (this.income - 42592) * 0.1482 + 4123;
					this.m_rate = this.m_rate + 0.1482;
				} else if (this.income <= 138491) { /*2019*/
					this.p_tax = (this.income - 85184) * 0.1652 + 10435;
					this.m_rate = this.m_rate + 0.1652;
				} else if (this.income <= 157778) { /*2019*/
					this.p_tax = (this.income - 138491) * 0.1784 + 19241;
					this.m_rate = this.m_rate + 0.1784;
				} else { /*2019*/
					this.p_tax = (this.income - 157778) * 0.203 + 22682;
					this.m_rate = this.m_rate + 0.203;
				}

				this.p_tax = Math.max(this.p_tax - ((10264 + this.payroll_tax_credits) * 0.0968), 0); /*2019*/
				this.p_tax = Math.max(this.p_tax - (this.taxable_e_div * 0.14) - (this.taxable_i_div * 0.0275), 0); /*2019*/
				break;

			// Newfoundland
			case 'NL':
				if (this.income <= 39591) { /*2019*/
					this.p_tax = this.income * 0.087;
					this.m_rate = this.m_rate + 0.087;
				} else if (this.income <= 75181) { /*2019*/
					this.p_tax = (this.income - 39591) * 0.145 + 3270;
					this.m_rate = this.m_rate + 0.145;
				}  else if (this.income <= 134224) { /*2019*/
					this.p_tax = (this.income - 75181) * 0.158 + 8721;
					this.m_rate = this.m_rate + 0.158;
				}  else if (this.income <= 187913) { /*2019*/
					this.p_tax = (this.income - 134224) * 0.173 + 18050;
					this.m_rate = this.m_rate + 0.173;
				} else { /*2019*/
					this.p_tax = (this.income - 187913) * 0.183 + 27338;
					this.m_rate = this.m_rate + 0.183;
				}
				this.p_tax = Math.max(this.p_tax - ((9414 + this.payroll_tax_credits) * 0.087), 0); /*2019*/
				this.p_tax = Math.max(this.p_tax - (this.taxable_e_div * 0.054) - (this.taxable_i_div * 0.035), 0); /*2019*/
				break;

			// Nova Scotia
			case 'NS':
				if (this.income <= 29590) { /*2019*/
					this.p_tax = this.income * 0.0879;
					this.m_rate = this.m_rate + 0.0879;
				} else if (this.income <= 59180) { /*2019*/
					this.p_tax = (this.income - 29590) * 0.1495 + 2601;
					this.m_rate = this.m_rate + 0.1495;
				} else if (this.income <= 93000) { /*2019*/
					this.p_tax = (this.income - 59180) * 0.1667 + 7025;
					this.m_rate = this.m_rate + 0.1667;
				} else if (this.income <= 150000) { /*2019*/
					this.p_tax = (this.income - 93000) * 0.1750 + 12662;
					this.m_rate = this.m_rate + 0.1750;
				} else { /*2019*/
					this.p_tax = (this.income - 150000) * 0.21 + 22637;
					this.m_rate = this.m_rate + 0.21;
				}

				this.ns_bpa = 8481; /*2019*/
				if (this.income < 25000){
					this.ns_bpa = this.ns_bpa + 3000;
				} else if (this.income < 75000){
					this.ns_bpa = this.ns_bpa + (75000 - this.income) * 0.06;
				}
				// console.log(this.ns_bpa);

				this.p_tax = Math.max(this.p_tax - ((this.ns_bpa + this.payroll_tax_credits) * 0.0879), 0); /*2019*/
				this.p_tax = Math.max(this.p_tax - (this.taxable_e_div * 0.0885) - (this.taxable_i_div * 0.0299), 0); /*2019*/
				break;

			// Northwest Territories
			case 'NT':
				if (this.income <= 43137) { /*2019*/
					this.p_tax = this.income * 0.059;
					this.m_rate = this.m_rate + 0.059;
				} else if (this.income <= 86277) { /*2019*/
					this.p_tax = (this.income - 43137) * 0.086 + 2545;
					this.m_rate = this.m_rate + 0.086;
				} else if (this.income <= 140267) { /*2019*/
					this.p_tax = (this.income - 86277) * 0.1220 + 6255;
					this.m_rate = this.m_rate + 0.1220;
				} else { /*2019*/
					this.p_tax = (this.income - 140267) * 0.1405 + 12842;
					this.m_rate = this.m_rate + 0.1405;
				}
				this.p_tax = Math.max(this.p_tax - ((14811 + this.payroll_tax_credits) * 0.059), 0); /*2019*/
				this.p_tax = Math.max(this.p_tax - (this.taxable_e_div * 0.115) - (this.taxable_i_div * 0.06), 0); /*2019*/
				break;

			// Nunavut
			case 'NU':
				if (this.income <= 45414) { /*2019*/
					this.p_tax = this.income * 0.04;
					this.m_rate = this.m_rate + 0.04;
				} else if (this.income <= 90829) { /*2019*/
					this.p_tax = (this.income - 45414) * 0.07 + 1817;
					this.m_rate = this.m_rate + 0.07;
				} else if (this.income <= 147667) { /*2019*/
					this.p_tax = (this.income - 90829) * 0.09 + 4996;
					this.m_rate = this.m_rate + 0.09;
				} else { /*2019*/
					this.p_tax = (this.income - 147667) * 0.115 + 10111;
					this.m_rate = this.m_rate + 0.115;
				}
				this.p_tax = Math.max(this.p_tax - ((13618 + this.payroll_tax_credits) * 0.04), 0); /*2019*/
				this.p_tax = Math.max(this.p_tax - (this.taxable_e_div * 0.0551) - (this.taxable_i_div * 0.0261), 0); /*2019*/
				break;

			// Ontario
			case 'ON':
				if (this.income <= 43906) { /*2019*/
					this.p_tax = this.income * 0.0505;
					this.m_rate = this.m_rate + 0.0505;
				} else if (this.income <= 87813) { /*2019*/
					this.p_tax = (this.income - 43906) * 0.0915 + 2217;
					this.m_rate = this.m_rate + 0.0915;
				} else if (this.income <= 150000) { /*2019*/
					this.p_tax = (this.income - 87813) * 0.1116 + 6235;
					this.m_rate = this.m_rate + 0.1116;
				} else if (this.income <= 220000) { /*2019*/
					this.p_tax = (this.income - 150000) * 0.1216 + 13175;
					this.m_rate = this.m_rate + 0.1216;
				} else { /*2019*/
					this.p_tax = (this.income - 220000) * 0.1316 + 21687;
					this.m_rate = this.m_rate + 0.1316;
				}
				this.p_tax = Math.max(this.p_tax - ((10582 + this.payroll_tax_credits) * 0.0505), 0); /*2019*/

				/*ON Surtax 2019*/
				if (this.p_tax >= 6067) {
					this.s_tax = ((this.p_tax - 4740) * 0.2) + ((this.p_tax - 6067) * 0.36);
				} else if (this.p_tax >= 4740) {
					this.s_tax = (this.p_tax - 4740) * 0.2;
				} else {
					this.s_tax = 0;
				}

				//marginal rate increase
				if (this.income > 220000) {
					this.m_rate = this.m_rate + (0.1316 * 0.56);
				} else if (this.income > 150000) {
					this.m_rate = this.m_rate + (0.1216 * 0.56);
				} else if (this.income > 91101) { /*2019*/ /* higher surtax starts here */
					this.m_rate = this.m_rate + (0.1116 * 0.56);
				} else if (this.income > 87813) { /*2019*/ /* next tax bracket starts here */
					this.m_rate = this.m_rate + (0.1116 * 0.2);
				} else if (this.income > 77313) { /*2019*/ /* lower surtax starts here */
					this.m_rate = this.m_rate + (0.0915 * 0.2);
				}
				/*End ON Surtax 2019*/

				/*ON DTC After Surtax 2019*/
				this.p_tax = this.p_tax + this.s_tax;
				this.p_tax = Math.max(this.p_tax - (this.taxable_e_div * 0.1) - (this.taxable_i_div * 0.032863), 0); /*2019*/

				// Ontario Health Premium 2019
				this.on_health = 0;
				if (this.income > 200600) {
					this.on_health = 900;
				} else if (this.income > 200000){
					this.on_health = ((this.income - 200000) * 0.25) + 750;
				} else if (this.income > 72600) {
					this.on_health = 750;
				} else if (this.income > 72000){
					this.on_health = ((this.income - 72000) * 0.25) + 600;
				} else if (this.income > 48600) {
					this.on_health = 600;
				} else if (this.income > 48000){
					this.on_health = ((this.income - 48000) * 0.25) + 450;
				} else if (this.income > 38500) {
					this.on_health = 450;
				} else if (this.income > 36000){
					this.on_health = ((this.income - 36000) * 0.06) + 300;
				} else if (this.income > 25000) {
					this.on_health = 300;
				} else if (this.income > 20000){
					this.on_health = ((this.income - 20000) * 0.06) + 0;
				}
				this.p_tax = this.p_tax + this.on_health;
				break;

			// Prince Edward Island
			case 'PE':
				if (this.income <= 31984) { /*2019*/
					this.p_tax = this.income * 0.098;
					this.m_rate = this.m_rate + 0.098;
				} else if (this.income <= 63969) { /*2019*/
					this.p_tax = (this.income - 31984) * 0.138 + 3134;
					this.m_rate = this.m_rate + 0.138;
				} else { /*2019*/
					this.p_tax = (this.income - 63969) * 0.167 + 7548;
					this.m_rate = this.m_rate + 0.167;
				}
				this.p_tax = Math.max(this.p_tax - ((9160 + this.payroll_tax_credits) * 0.098), 0); /*2019*/
				this.p_tax = Math.max(this.p_tax - (this.taxable_e_div * 0.105) - (this.taxable_i_div * 0.0274), 0); /*2019*/

				/*PE Surtax 2019*/
				if (this.p_tax >= 12500) {
					this.s_tax = (this.p_tax - 12500) * 0.1;
				} else {
					this.s_tax = 0;
				}

				//marginal rate increase
				if (this.income > 98997) { /* 2019 */
					this.m_rate = this.m_rate + 0.167 * 0.1;
				}
				/*End PE Surtax 2019*/

				this.p_tax = this.p_tax + this.s_tax;
				break;

			// Quebec
			case 'QC':
				if (this.income <= 43790) { /*2019*/
					this.p_tax = this.income * 0.15;
					this.m_rate = this.m_rate + 0.15;
				} else if (this.income <= 87575) { /*2019*/
					this.p_tax = (this.income - 43790) * 0.20 + 6568.5;
					this.m_rate = this.m_rate + 0.2;
				} else if (this.income <= 106555) { /*2019*/
					this.p_tax = (this.income - 87575) * 0.24 + 15325.5;
					this.m_rate = this.m_rate + 0.24;
				} else { /*2019*/
					this.p_tax = (this.income - 106555) * 0.2575 + 19880.7;
					this.m_rate = this.m_rate + 0.2575;
				}
				this.p_tax = Math.max(this.p_tax - (15269 * 0.15), 0); /*2019*/
				this.p_tax = Math.max(this.p_tax - (this.taxable_e_div * 0.1178) - (this.taxable_i_div * 0.0555), 0); /*2019*/
				break;

			// Saskatchewan
			case 'SK':
				if (this.income <= 45225) { /*2019*/
					this.p_tax = this.income * 0.1050;
					this.m_rate = this.m_rate + 0.1050;
				} else if (this.income <= 129214) { /*2019*/
					this.p_tax = (this.income - 45225) * 0.1250 + 4749;
					this.m_rate = this.m_rate + 0.1250;
				} else { /*2019*/
					this.p_tax = (this.income - 129214) * 0.1450 + 15247;
					this.m_rate = this.m_rate + 0.1450;
				}
				this.p_tax = Math.max(this.p_tax - ((16065 + this.payroll_tax_credits) * 0.1050), 0); /*2019*/
				this.p_tax = Math.max(this.p_tax - (this.taxable_e_div * 0.11) - (this.taxable_i_div * 0.03362), 0); /*2019*/
				break;

			// Yukon
			case 'YT':
				if (this.income <= 47630) { /*2019*/
					this.p_tax = this.income * 0.064;
					this.m_rate = this.m_rate + 0.064;
				} else if (this.income <= 92259) { /*2019*/
					this.p_tax = (this.income - 47630) * 0.09 + 3048;
					this.m_rate = this.m_rate + 0.09;
				} else if (this.income <= 147667) { /*2019*/
					this.p_tax = (this.income - 92259) * 0.109 + 7335;
					this.m_rate = this.m_rate + 0.109;
				} else if (this.income <= 500000) { /*2019*/
					this.p_tax = (this.income - 147667) * 0.128 + 13047;
					this.m_rate = this.m_rate + 0.128;
				} else { /*2019*/
					this.p_tax = (this.income - 500000) * 0.15 + 58146;
					this.m_rate = this.m_rate + 0.15;
				}
				this.p_tax = Math.max(this.p_tax - ((12069 + this.can_emp_amt + this.payroll_tax_credits) * 0.064), 0); /*2019*/
				this.p_tax = Math.max(this.p_tax - (this.taxable_e_div * 0.12020) - (this.taxable_i_div * 0.023), 0); /*2019*/
				break;

		}

		// Totals
		// ------------------------------------------------------

		// Total Tax
		this.tax = this.f_tax + this.p_tax + this.payroll_deductions + this.se_cpp_premiums;

		// Effective Rate
		this.e_rate = this.tax / (this.income_a + this.income_se + this.c_g + this.e_div + this.i_div) || 0;

		// Tax Refund or Owing
		// doesn't include payroll deductions
		this.refund = this.tax_paid - (this.f_tax + this.p_tax + this.se_cpp_premiums);

	}


	// Refresh page
	function refreshPage() {
		// inputs, numeric values should be converted to numbers
		var inputs = {
			prov: $('#fieldProvince').val(),
			income_emp: AutoNumeric.getNumber('#fieldIncome'),
			income_se: AutoNumeric.getNumber('#fieldSEIncome'),
			rrsp_d: AutoNumeric.getNumber('#fieldRRSP'),
			c_g: AutoNumeric.getNumber('#fieldCapGains'),
			e_div: AutoNumeric.getNumber('#fieldEDivs'),
			i_div: AutoNumeric.getNumber('#fieldIDivs'),
			other_inc: AutoNumeric.getNumber('#fieldOtherIncome'),
			tax_paid: AutoNumeric.getNumber('#fieldTaxesPaid')
		};

		if (!inputs.prov) { // don't run with no province set
			return;
		}

		// crunch the numbers
		var calc = new taxCalc(inputs);
		var rrspDiff = 0;
		if (inputs.rrsp_d > 0) {
			var xRrspCalc = new taxCalc( $.extend({}, inputs, {rrsp_d: 0}) );
			rrspDiff = Math.abs(calc.tax - xRrspCalc.tax);
		}

		// results
		var $taxCalcAnswers = $('#taxcalcanswers');
		var $showRefund = $taxCalcAnswers.find('.showRefund').addClass('hidden');
		var $showOwing = $taxCalcAnswers.find('.showOwing').addClass('hidden');
		var $showTaxPaid = $taxCalcAnswers.find('.showTaxPaid').addClass('hidden');
		var $showCPPEIPremiums = $taxCalcAnswers.find('.showCPPEIPremiums').addClass('hidden');
		var $showSelfEmpCPP = $taxCalcAnswers.find('.showSelfEmpCPP').addClass('hidden');
		var $showRRSP = $taxCalcAnswers.find('.showRRSP').addClass('hidden');
		var $showCPP = $('.showCPP').addClass('hidden');
		var $showQPP = $('.showQPP').addClass('hidden');

		AutoNumeric.set('.answerTaxes', calc.tax);
		AutoNumeric.set('.answerFederal', calc.f_tax);
		AutoNumeric.set('.answerProvincial', calc.p_tax);
		AutoNumeric.set('.answerAmount', Math.abs(calc.refund));
		AutoNumeric.set('.answerTotalInc', calc.income_a + calc.income_se + calc.c_g + calc.e_div + calc.i_div);
		AutoNumeric.set('.answerAfterTax', calc.income_a + calc.income_se + calc.c_g + calc.e_div + calc.i_div - calc.tax);
		AutoNumeric.set('.answerPayroll', calc.payroll_deductions);
		AutoNumeric.set('.answerCPP', calc.se_cpp_premiums);
		AutoNumeric.set('.answerRRSP', rrspDiff);
		AutoNumeric.set('.answerERate', calc.e_rate * 100);
		AutoNumeric.set('.answerMRate', calc.m_rate * 100);

		// show refund or owing amount
		if (calc.refund >= 0) {
			$showRefund.removeClass('hidden');
		} else {
			$showOwing.removeClass('hidden');
		}

		// show the taxes paid sentence
		if (calc.tax_paid > 0) {
			$showTaxPaid.removeClass('hidden');
		}

		// show CPP/EI premiums
		if (calc.payroll_deductions > 0) {
			$showCPPEIPremiums.removeClass('hidden');
		}

		// show self-employment CPP
		if (calc.se_cpp_premiums > 0) {
			$showSelfEmpCPP.removeClass('hidden');
		}

		// show the RRSP sentence
		if (rrspDiff > 0) {
			$showRRSP.removeClass('hidden');
		}

		if (calc.prov === 'QC') {
			$showQPP.removeClass('hidden');
		}
		else {
			$showCPP.removeClass('hidden');
		}
	};

	// listeners
	$('#taxcalcfields').on('keyup', 'input, select', function(event) {
		refreshPage();
	});
	$('#taxcalcfields').on('change', 'select', function(event) {
		refreshPage();
	});
});