# if VCF does not have MAF in INFO column, add it;
# Use ln -s if the input .vcf.gz file has INFO/MAF.
# Also create %.MAF.vcf.gz.csi, by ln -s or  -i --index-name
# stdout will contain filename so don't echo command.
%.MAF.vcf.gz : %.vcf.gz
	@if gzip -d < "$<"  | grep -C1 '^#CHROM'  | fgrep MAF= >/dev/null;	\
	then	\
	  ln -s "$<" "$@";	\
	  if [ -e "$<.csi" ];	\
	    then	\
	      ln -s "$<.csi" "$@.csi";	\
	    else	\
	      bcftools index "$@";	\
	  fi;	\
	else	\
	  bcftools +fill-tags "$<"  -- -t MAF | bgzip -i --index-name "$@.csi" > "$@";	\
	fi
