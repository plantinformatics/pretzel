import Application from 'pretzel-frontend/app';
import config from 'pretzel-frontend/config/environment';
import { setApplication } from '@ember/test-helpers';
import { start } from 'ember-qunit';

setApplication(Application.create(config.APP));

start();
