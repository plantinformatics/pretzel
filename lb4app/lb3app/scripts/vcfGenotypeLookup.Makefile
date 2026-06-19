#-------------------------------------------------------------------------------
# bash is used in the allChr for loop
SHELL := /bin/bash
#-------------------------------------------------------------------------------

# Using make options -rR (-r, --no-builtin-rules; -R, --no-builtin-variables)
# is preferable because all the standard suffixes and rules are not applicable.

.SUFFIXES:            # Delete the default suffixes
.SUFFIXES: .vcf.gz .csi      # Define a new suffix list

#.NOTINTERMEDIATE
#.SECONDARY
# .PRECIOUS prevents .csi from being removed as an intermediate file.
# In testing, it appears that .PRECIOUS % is limited to matching basenames, i.e. %.vcf.gz does not match %.MAF.vcf.gz etc
# Either .PRECIOUS or .NOTINTERMEDIATE should suffice for this purpose.
# Alternative : $(allVcfGz) is used.
# refn : https://www.gnu.org/software/make/manual/html_node/Special-Targets.html
.PRECIOUS: %.vcf.gz %.vcf.gz.csi %.MAF.vcf.gz %.MAF.SNPList.vcf.gz %.MAF.vcf.gz.csi %.MAF.SNPList.vcf.gz.csi

allChr:=all_chromosomes
allVcfGz != [ -f $(allChr).vcf.gz ] && bcftools query -f '%CHROM\n' $(allChr).vcf.gz | uniq | sed "s/$$/.vcf.gz/"
.NOTINTERMEDIATE: $(allVcfGz)

#-------------------------------------------------------------------------------

# if VCF does not have MAF or (AC and AN) in INFO column, add it;
# Use ln -s if the input .vcf.gz file has INFO/MAF or (INFO/ AC and AN).
# Tested : 'MAF=|AN=.*;AC=|AC=.*;AN=' : bcftools query ... %INFO/MAF got :
#  Error: Error: no such tag defined in the VCF header: INFO/MAF. FORMAT fields must be in square brackets, e.g. "[ MAF]"
#
# +fill-tags -t F_MISSING was added to bcftools after version 1.9. it is in version 1.19.
# INFO/CR can be added in a separate process, after NS is added : +fill-tags -t CR:1=NS/N_SAMPLES
# %.vcf.gz.csi is required by +fill-tags.
#
# Also create %.MAF.vcf.gz.csi, by ln -s or bcftools index (possibly : bgzip  -i --index-name)
# stdout will contain filename, read by the caller of dbName2Vcf(),  so don't echo command.
%.MAF.vcf.gz : %.vcf.gz %.vcf.gz.csi
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

# 	$(MAKE) -d $<.csi;


# use bcftools index instead of : bcftools ... -i --index-name "$@.csi"
# because bcftools -i seems to generate incomplete / truncated .csi files.
#
# This rule is used by the above dependency %.MAF.vcf.gz : ... %.vcf.gz.csi
# That rule also does 2 'bcftools index' on the result; not simple to
# separate that out because (fgrep MAF= ... ln -s ... ) ties them together.
%.vcf.gz.csi : %.vcf.gz
	@bcftools index "$<";
# pgrep -lf bcftools | fgrep 'bcftools index' > /tmp/$USER/pgrep_bcftools_index; 

# Without .PRECIOUS, the above rule will cause the .vcf.gz file dependency to be
# considered an intermediate file and automatically removed after making the
# output, as the rules to make .vcf.gz and .vcf.gz.csi are considered "chained
# rules".  Also : make ... chr3H.MAF.SNPList.vcf.gz{,.csi} establishes that both
# the .vcf.gz and .vcf.gz.csi are required, and so the .vcf.gz is not removed.


#-------------------------------------------------------------------------------

# These could be used to replace part of ensureSNPList()
%.vcf.gz.MAFName : %.vcf.gz
	echo $*.MAF.vcf.gz
%.vcf.gz.SNPListName : %.vcf.gz
	echo $*.SNPList.vcf.gz

# -G ( --drop-genotypes) does not preserve ##FORMAT=<ID=... GT and NU, so
# save the header and re-add it with reheader.
#
# only require information from cols 1-5, but VCF requires 1-9, i.e. including : QUAL FILTER INFO FORMAT
# Seems that 1 sample column is required, so request 1-10
# (option abbreviations : -G = --drop-genotypes, -O = --output-type, -o = --output)
# Using Bourne-shell notation `` instead of bash $() for nproc to avoid clash with make variable expansion syntax.
%.SNPList.vcf.gz : %.vcf.gz
	@bcftools view -h $< > original_header.txt && \
	bcftools view --drop-genotypes --threads `nproc` --output-type z $<  --output $@.tmp; \
	bcftools reheader -h original_header.txt  $@.tmp -o $@ && \
	rm $@.tmp


#-------------------------------------------------------------------------------

# $(chromosomes) can be defined using !=, as for allVcfGz
$(allVcfGz) : $(allChr).vcf.gz $(allChr).vcf.gz.csi
	@chromosomes=( $$(bcftools query -f '%CHROM\n' $(allChr).vcf.gz | uniq) ); \
	for chr in "$${chromosomes[@]}" ; do bcftools view -r $$chr $(allChr).vcf.gz -Oz -o $$chr.vcf.gz; done

$(allChr).vcf.gz.csi : $(allChr).vcf.gz
	@bcftools index $(allChr).vcf.gz


#-------------------------------------------------------------------------------
