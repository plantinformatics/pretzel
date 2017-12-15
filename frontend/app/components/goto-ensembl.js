import Ember from 'ember';


export default Ember.Component.extend({


  urlEnsembl : Ember.computed('markerName', function (newValue) {
    let
      markerName = this.get('markerName'),
    protocol = "http://",
    domain = "plants.ensembl.org",
    port = "",
    path = "/Triticum_aestivum/Search/Results?",
    args1="species=Triticum%20aestivum;idx=;",
    query="q=" + markerName + ";", // TRIAE_CS42_3DL_TGACv1_249024_AA0834820;
    args2="site=ensemblthis",
    url = protocol + domain + port + path + args1 + query + args2;
    console.log("urlEnsembl", markerName);

    return url;
  })

  /*----------------------------------------------------------------------------*/

});
