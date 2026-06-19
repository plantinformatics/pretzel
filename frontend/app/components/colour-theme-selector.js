import Component from '@glimmer/component';
import { computed, action, set as Ember_set } from '@ember/object';
import { tracked } from '@glimmer/tracking';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

/**
 * The colours for the theme are from this publication :
https://www.nceas.ucsb.edu/sites/default/files/2022-06/Colorblind%20Safe%20Color%20Schemes.pdf
NCEAS Science Communication Resource Corner
Last updated: 6/29/22 Alexandra Phillips
2. Use pre-existing colorblind safe palettes
IBM Design Library
R 000	R 046	R 051	R 093	R 148
G 000	G 037	G 117	G 168	G 203
B 000	B 133	B 056	B 153	B 236

 * Other resources :
https://www.ibm.com/design/language/color/
https://web.archive.org/web/20241231124736/https://personal.sron.nl/~pault/
...
ColorBlindness R Package: Compilation of >15 color blind safe palettes for
plotting and other data visualizations with discrete color palettes
->
https://cran.r-project.org/web/packages/colorBlindness/vignettes/colorBlindness.html#How_to_use_this_package

https://github.com/IBM-Design/colors
https://github.com/IBM-Design/colors/blob/master/source/colors.js

https://jfly.uni-koeln.de/color/
Color Universal Design (CUD)
- How to make figures and presentations that are friendly to Colorblind people -
Masataka Okabe,  Jikei Medial School (Japan)
Kei Ito, University of Tokyo, Institute for Molecular and Cellular Biosciences (Japan)


https://siegal.bio.nyu.edu/color-palette/

 */

const
baseColour_Null = '#ff8a7d';

const themes = [
  {
    name: 'light',
    variables: {
      '--gt-background-color-Ref': '#b1c1e8',
      '--gt-background-color-Het': '#d9edf7',
      '--gt-background-color-Alt': '#ffc8ae',
      '--gt-background-color-Null': baseColour_Null,
      '--gt-background-color-Missing': '#ffffff',
      '--gt-background-color-selected-snp': 'springgreen'
    }
  },
  {
    name: 'dark',
    variables: {
      '--gt-background-color-Ref': 'rgb(53, 57, 59)',
      '--gt-background-color-Het': 'rgb(14, 48, 65)',
      '--gt-background-color-Alt': 'rgb(100, 32, 0)',
      '--gt-background-color-Null': baseColour_Null,
      '--gt-background-color-Missing': 'rgb(24, 26, 27)',
      '--gt-background-color-selected-snp': 'rgb(0, 204, 127)'
    }
  },
  {
    name: 'colour-blind - Okabe and Ito',
    /** unused colours, in image position left to right :
rgb(000, 000, 000)

rgb(000, 114, 178)





    */
    variables: {
      '--gt-background-color-Ref': 'rgb( 86, 180, 233)',
      '--gt-background-color-Het': 'rgb(213, 094, 000)',
      '--gt-background-color-Alt': 'rgb(230, 159, 000)',
      '--gt-background-color-Null': 'rgb(204, 121, 167)', // baseColour_Null
      '--gt-background-color-Missing': 'rgb(240, 228,  66)',
      '--gt-background-color-selected-snp': 'rgb(000, 158, 115)'
    }
  },
  {
    name: 'colour-blind - IBM Design Library',
    variables: {
      '--gt-background-color-Ref': 'rgb(91, 142, 253)',
      '--gt-background-color-Het': 'rgb( 46,  37, 133)',
      '--gt-background-color-Alt': 'rgb( 93, 168, 153)',
      '--gt-background-color-Null': baseColour_Null,
      '--gt-background-color-Missing': 'rgb(148, 203, 236)',
      '--gt-background-color-selected-snp': 'rgb( 51, 117,  56)'
    }
  }
];

//------------------------------------------------------------------------------

export default class ColourThemeSelectorComponent extends Component {
  /** Name of colour theme selected by user. Default is the first theme - 'light'. */
  @tracked
  userColourThemeName;

  themes = themes;

  //----------------------------------------------------------------------------

  constructor() {
    super(...arguments);

    const
    /** can now use controls service .userSettings.localStorage */
    item = window.localStorage.getItem('userColourTheme'),
    storedTheme = item && JSON.parse(item),
    storedThemeOK = themes.findBy('name', storedTheme);
    if (! storedThemeOK) {
      dLog('constructor', storedTheme, 'not present in themes', themes, this);
    }
    Ember_set(this, 'userColourThemeName',  storedThemeOK ? storedTheme : themes[0].name);
    this.applyTheme(this.userColourThemeName);
  }

  @computed('userColourThemeName')
  get userColourTheme () {
    const
    fnName = 'userColourTheme',
    theme = themes.findBy('name', this.userColourThemeName);
    if (! theme) {
      dLog(fnName, this.userColourThemeName, 'not present in themes', themes, this);
      theme = themes[0];
      this.userColourThemeName = theme.name;
    }
                 
    return theme;
  }

  applyTheme(themeName) {
    let theme = themes.find(theme => theme.name === themeName);
    if (theme && theme.variables) {
      Object.entries(theme.variables).forEach(([varName, varValue]) => {
        document.documentElement.style.setProperty(varName, varValue);
      });
    }
  }

  @action
  changeTheme(event) {
    this.userColourThemeName = event.target.value;
    window.localStorage.setItem('userColourTheme', JSON.stringify(this.userColourThemeName));
    this.applyTheme(this.userColourThemeName);
  }
}
