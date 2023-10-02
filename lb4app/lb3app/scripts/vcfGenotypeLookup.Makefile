# if VCF does not have MAF or (AC and AN) in INFO column, add it;
# Use ln -s if the input .vcf.gz file has INFO/MAF or (INFO/ AC and AN).
# Also create %.MAF.vcf.gz.csi, by ln -s or bcftools index (possibly : bgzip  -i --index-name)
# stdout will contain filename, read by the caller of dbName2Vcf(),  so don't echo command.
%.MAF.vcf.gz : %.vcf.gz
        @if gzip -d < "$<"  | grep -C1 '^#CHROM'  | grep -v '^#' | egrep 'MAF=|AN=.*;AC=|AC=.*;AN=' >/dev/null;	\
        then	\
          ln -s "$<" "$@";	\
          if [ -e "$<.csi" ];	\
            then	\
              ln -s "$<.csi" "$@.csi";	\
            else	\
              bcftools index "$@";	\
          fi;	\
        else	\
          bcftools +fill-tags "$<"  -- -t MAF,AN,AC | bgzip  > "$@";	\
          bcftools index "$@";	\
        fi

# use bcftools index instead of : bcftools ... -i --index-name "$@.csi"
# because bcftools -i seems to generate incomplete / truncated .csi files.
#
# So the .csi generation might be split into a separate rule e.g.
%.vcf.gz.csi : %.vcf.gz
          bcftools index "$@";
# (although the (fgrep MAF= ... ln -s ... ) ties them together).

#-------------------------------------------------------------------------------

# These could be used to replace part of ensureSNPList()
%.vcf.gz.SNPListName : %.vcf.gz
        echo $*.SNPList.vcf.gz
%.SNPList.vcf.gz : %.vcf.gz
        # only require information from cols 1-5, but VCF requires 1-9, i.e. including : QUAL FILTER INFO FORMAT
        # Seems that 1 sample column is required, so request 1-10
        zcat $<  | cut -f1-10  | bgzip -c > $@

#-------------------------------------------------------------------------------
