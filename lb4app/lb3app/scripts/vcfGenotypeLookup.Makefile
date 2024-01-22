# if VCF does not have MAF or (AC and AN) in INFO column, add it;
# Use ln -s if the input .vcf.gz file has INFO/MAF or (INFO/ AC and AN).
# Tested : 'MAF=|AN=.*;AC=|AC=.*;AN=' : bcftools query ... %INFO/MAF got :
#  Error: Error: no such tag defined in the VCF header: INFO/MAF. FORMAT fields must be in square brackets, e.g. "[ MAF]"
#
# +fill-tags -t F_MISSING was added to bcftools after version 1.9. it is in version 1.19.
# INFO/CR can be added in a separate process, after NS is added : +fill-tags -t CR:1=NS/N_SAMPLES
#
# Also create %.MAF.vcf.gz.csi, by ln -s or bcftools index (possibly : bgzip  -i --index-name)
# stdout will contain filename, read by the caller of dbName2Vcf(),  so don't echo command.
%.MAF.vcf.gz : %.vcf.gz
	@if gzip -d < "$<" | head -1000 | grep -C1 '^#CHROM'  | grep -v '^#' | egrep 'MAF=' | egrep 'AC=' | egrep 'AC_Het=' | egrep 'F_MISSING=' >/dev/null;	\
	then	\
	  ln -s "$<" "$@";	\
	  if [ -e "$<.csi" ];	\
	    then	\
	      ln -s "$<.csi" "$@.csi";	\
	    else	\
	      bcftools index "$@";	\
	  fi;	\
	else	\
	  bcftools +fill-tags "$<"  -- -t MAF,AN,AC,AC_Het,NS,F_MISSING | bgzip  > "$@";	\
	  bcftools index "$@";	\
	fi

# use bcftools index instead of : bcftools ... -i --index-name "$@.csi"
# because bcftools -i seems to generate incomplete / truncated .csi files.
#
# So the .csi generation might be split into a separate rule e.g.
%.vcf.gz.csi : %.vcf.gz
	  bcftools index "$<";
# (although the (fgrep MAF= ... ln -s ... ) ties them together).

#-------------------------------------------------------------------------------

# These could be used to replace part of ensureSNPList()
%.vcf.gz.MAFName : %.vcf.gz
	echo $*.MAF.vcf.gz
%.vcf.gz.SNPListName : %.vcf.gz
	echo $*.SNPList.vcf.gz
%.SNPList.vcf.gz : %.vcf.gz
	# only require information from cols 1-5, but VCF requires 1-9, i.e. including : QUAL FILTER INFO FORMAT
	# Seems that 1 sample column is required, so request 1-10
	zcat $<  | cut -f1-10  | bgzip -c > $@

#-------------------------------------------------------------------------------
