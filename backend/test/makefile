SHELL := /bin/bash
# SOMETHING = hiya
all: clean downloadData filterData

downloadData:
	mkdir -p ./testdata
	wget https://github.com/plantinformatics/pretzel-input-generator/releases/download/v1.0/pretzel-genomes-features-aliases-JSON.tar.gz

filterData:
	tar xzf pretzel-genomes-features-aliases-JSON.tar.gz
	mv -t ./testdata/ $$(ls -d ./JSON/Triticum_aestivum_IWGSC_RefSeq_v1.0* | egrep 'HC_annotation|genome|v1.0_HC_aliases')
	rm -r JSON

clean:
	rm -rf ./testdata