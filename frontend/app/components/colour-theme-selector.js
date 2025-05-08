import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { storageFor } from 'ember-local-storage';

export default class ColourThemeSelectorComponent extends Component {
  userColourTheme = storageFor('userColourTheme');

  themes = [
    {
      name: 'light',
      variables: {
        '--background-color': '#ffffff',
        '--text-color': '#000000'
      }
    },
    {
      name: 'dark',
      variables: {
        '--background-color': '#000000',
        '--text-color': '#ffffff'
      }
    },
    {
      name: 'red-green colour-blind',
      variables: {
        '--background-color': '#f0e68c',
        '--text-color': '#333333'
      }
    }
  ];

  @tracked selectedThemeName = this.userColourTheme.get('colourThemeName') || 'light';

  constructor() {
    super(...arguments);
    this.applyTheme(this.selectedThemeName);
  }

  applyTheme(themeName) {
    let theme = this.themes.find(theme => theme.name === themeName);
    if (theme && theme.variables) {
      Object.entries(theme.variables).forEach(([varName, varValue]) => {
        document.documentElement.style.setProperty(varName, varValue);
      });
    }
  }

  @action
  changeTheme(event) {
    this.selectedThemeName = event.target.value;
    this.userColourTheme.set('colourThemeName', this.selectedThemeName);
    this.applyTheme(this.selectedThemeName);
  }
}
