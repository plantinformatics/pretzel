testdata:
	mkdir ./testdata
	wget https://github.com/plantinformatics/pretzel-input-generator/releases/download/v1.0/pretzel-genomes-features-aliases-JSON.tar.gz
	tar xzf pretzel-genomes-features-aliases-JSON.tar.gz
	mv ./JSON/* ./testdata/
	rmdir ./JSON
	rm ./testdata/*LC*
	find ./testdata/ -type f ! -name Triticum_aestivum_IWGSC_RefSeq_v1.0\* -delete
	find ./testdata/ -type f ! -name "*annotation*" ! -name "*genome*" ! -name "*v1.0_HC_aliases*" -delete
	
checkjq:
	if command -v jq; then echo "jq"; else echo "no jq"; fi

clean:
	rm -rf ./testdata