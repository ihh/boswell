
all: lwpaper.pdf.open

%.open: %
	open $<

%.pdf: %.tex %.bib
	pdflatex $*.tex
	bibtex $*
	pdflatex $*.tex
	pdflatex $*.tex

clean:
	rm lwpaper.pdf *.aux *.log *.bbl *.blg

.SECONDARY:
