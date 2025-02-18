import React from 'react';
import * as globals from './globals';

function onClick(e) {
    const targetQuestion = e.target.closest('.regulomehelp-question');
    if (targetQuestion !== null) {
        const infoId = targetQuestion.id.split('regulomehelp-faq')[1].split('-question')[0];
        const infoElement = document.getElementById(`regulomehelp-faq${infoId}-answer`);
        infoElement.classList.toggle('show');
        const iconElement = e.target.getElementsByTagName('i')[0];
        if (e.target.getElementsByTagName('i')[0].className.indexOf('icon-caret-right') > -1) {
            iconElement.classList.add('icon-caret-down');
            iconElement.classList.remove('icon-caret-right');
        } else {
            iconElement.classList.remove('icon-caret-down');
            iconElement.classList.add('icon-caret-right');
        }
    }
}

const RegulomeHelp = () => (
    <div className="richtextblock">
        <h1 className="page-title">Help</h1>
        <p>RegulomeDB is a database that annotates SNPs with known and predicted regulatory elements in the intergenic regions of the <i>H. sapiens</i> genome. Known and predicted regulatory DNA elements include regions of DNase hypersensitivity, binding  sites oftranscription factors, and promoter regions that have been biochemically characterized to regulation transcription. Sources of these data include public datasets from GEO, the ENCODE project, and published literature.</p>
        <div className="faq" onClick={onClick}>
            <p className="regulomehelp-question" id="regulomehelp-faq1-question">
                <strong><i className="icon icon-caret-right" />How do I submit my data?</strong>
            </p>
            <div className="regulomehelp-answer" id="regulomehelp-faq1-answer">
                <p>Users can submit queries to the RegulomeDB database in the following formats:</p>
                <ul>
                    <li>dbSNP IDs</li>
                    <li>0-based coordinates: As chrom:chromStart-chromEnd in BED format.</li>
                </ul>
            </div>

            <p className="regulomehelp-question" id="regulomehelp-faq2-question">
                <strong><i className="icon icon-caret-right" />What is displayed on the summary of SNP analysis page?</strong>
            </p>
            <div className="regulomehelp-answer" id="regulomehelp-faq2-answer">
                <p>A summary of the total number of rows analyzed and coordinates searched will be displayed in addition to any errors located in the query. The rest of the page includes the nucleotides entered in the query and the data associated with      thenucleotides. The table contains the following columns of data:</p>
                <ul>
                    <li>0-based coordinates: As chrom:chromStart..chromEnd in BED format.</li>
                    <li>dbSNP IDs: If available, the dbSNP ID for that coordinate is displayed.</li>
                    <li>Rank: This is the original RegulomeDB score computed based on the integration of multiple high-throughput datasets. Additional details are described in the next question.</li>
                    <li>Score: This is our new RegulomeDB score generated using our machine learning approach and detailed below.</li>
                </ul>
            </div>

            <p className="regulomehelp-question" id="regulomehelp-faq3-question">
                <strong><i className="icon icon-caret-right" />What does the RegulomeDB rank represent?</strong>
            </p>
            <div className="regulomehelp-answer" id="regulomehelp-faq3-answer">
                <p>The scoring scheme refers to the following available datatypes for a single coordinate.</p>
                <table>
                    <tbody>
                        <tr>
                            <th>Score</th>
                            <th>Supporting data</th>
                        </tr>
                        <tr>
                            <td>1a</td>
                            <td>eQTL + TF binding + matched TF motif + matched DNase Footprint + DNase peak</td>
                        </tr>
                        <tr>
                            <td>1b</td>
                            <td>eQTL + TF binding + any motif + DNase Footprint + DNase peak</td>
                        </tr>
                        <tr>
                            <td>1c</td>
                            <td>eQTL + TF binding + matched TF motif + DNase peak</td>
                        </tr>
                        <tr>
                            <td>1d</td>
                            <td>eQTL + TF binding + any motif + DNase peak</td>
                        </tr>
                        <tr>
                            <td>1e</td>
                            <td>eQTL + TF binding + matched TF motif</td>
                        </tr>
                        <tr>
                            <td>1f</td>
                            <td>eQTL + TF binding / DNase peak</td>
                        </tr>
                        <tr>
                            <td>2a</td>
                            <td>TF binding + matched TF motif + matched DNase Footprint + DNase peak</td>
                        </tr>
                        <tr>
                            <td>2b</td>
                            <td>TF binding + any motif + DNase Footprint + DNase peak</td>
                        </tr>
                        <tr>
                            <td>2c</td>
                            <td>TF binding + matched TF motif + DNase peak</td>
                        </tr>
                        <tr>
                            <td>3a</td>
                            <td>TF binding + any motif + DNase peak</td>
                        </tr>
                        <tr>
                            <td>3b</td>
                            <td>TF binding + matched TF motif</td>
                        </tr>
                        <tr>
                            <td>4</td>
                            <td>TF binding + DNase peak</td>
                        </tr>
                        <tr>
                            <td>5</td>
                            <td>TF binding or DNase peak</td>
                        </tr>
                        <tr>
                            <td>6</td>
                            <td>Motif hit</td>
                        </tr>
                        <tr>
                            <td>7</td>
                            <td>Other</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <p className="regulomehelp-question" id="regulomehelp-faq4-question">
                <strong><i className="icon icon-caret-right" />Can I download precalculated scores from RegulomeDB?</strong>
            </p>
            <div className="regulomehelp-answer" id="regulomehelp-faq4-answer">
                <p>We currently have RegulomeDB rank scores available for common SNVs (Single Nucleotide Variants) in NCBI dbSNP Build 153. The scores were generated including all newly released ENCODE datasets. You can download the file here: <a href="https://regulome-master.demo.encodedcc.org/files/TSTFF344324/@@download/TSTFF344324.tsv">regulomedb_dbsnp153_common_snv.tsv</a>.</p>
                <p>We are still working on refining our algorithm for probability scores, they will be provided once we have a final version.</p>
            </div>

            <p className="regulomehelp-question" id="regulomehelp-faq5-question">
                <strong><i className="icon icon-caret-right" />How to interpret the new RegulomeDB probability score?</strong>
            </p>
            <div className="regulomehelp-answer" id="regulomehelp-faq5-answer">
                <p>The RegulomeDB probability score is ranging from 0 to 1, with 1 being most likely to be a regulatory variant. The RegulomeDB score represents a model integrating functional genomics features along with continuous values such as ChIP-seq      signal, DNase-seq signal, information content change, and DeepSEA scores among others. For more detail see our manuscript:</p>
                <p className="citation">Dong S and Boyle AP. Predicting functional variants in enhancer and promoter elements using RegulomeDB. Human Mutation 2019, 40:1292-1298. PMID: 31228310.</p>
                <p> There is an overall positive correlation between the ranking scores and the probability scores, but there are some exceptions because 1) we added additional features when predicting probability scores. 2) features used in probability      scoring were weighted differently from ranking scoring. We are working on further refining our algorithm.</p>
            </div>

            <p className="regulomehelp-question" id="regulomehelp-faq6-question">
                <strong><i className="icon icon-caret-right" />What details are provided for the datatypes supporting a SNP?</strong>
            </p>
            <div className="regulomehelp-answer" id="regulomehelp-faq6-answer">
                <p>This page lists all the DNA features and regulatory regions that have been identified to contain the input coordinate.</p>
                <ul>
                    <li>Transcription factor binding sites</li>
                    <li>Position-Weight Matrix for TF binding (PWM)</li>
                    <li>DNase Footprinting</li>
                    <li>Open Chromatin</li>
                    <li>Chromatin States</li>
                    <li>eQTLs</li>
                    <li>Validated functional SNPs</li>
                </ul>
            </div>

            <p className="regulomehelp-question" id="regulomehelp-faq7-question">
                <strong><i className="icon icon-caret-right" />What data is currently available at RegulomeDB?</strong>
            </p>

            <div className="regulomehelp-answer" id="regulomehelp-faq7-answer">
                <p>RegulomeDB can currently query the following data types:</p>
                <p><em>ENCODE</em><br /> RegulomeDB now directly uses all available ENCODE datasets including newly released data.</p>
                <p><em>Position-Weight Matrix for TF binding (PWM)</em><br />JASPAR 2020 Release</p>
                <p><em>eQTLs / dsQTLs</em><br /> Tissue types:</p>
                <ul>
                    <li>Cerebellum</li>
                    <li>Cortex</li>
                    <li>Fibroblasts</li>
                    <li>Frontal-Cortex</li>
                    <li>Liver</li>
                    <li>Lymphoblastoid</li>
                    <li>Monocytes</li>
                    <li>Pons</li>
                    <li>T-cells</li>
                    <li>Temporal-Cortex</li>
                </ul>
                <p><em>DNase Footprinting</em></p>
                <ul>
                    <li>Boyle et al.</li>
                    <li>Pique-Regi et al.</li>
                    <li>Piper et al.</li>
                </ul>
            </div>

            <p className="regulomehelp-question" id="regulomehelp-faq8-question">
                <strong><i className="icon icon-caret-right" />What version of dbSNP is RegulomeDB querying?</strong>
            </p>
            <p className="regulomehelp-answer" id="regulomehelp-faq8-answer">RegulomeDB is currently querying build 153 of dbSNP. See NCBI for additional information about <a href="https://www.ncbi.nlm.nih.gov/projects/SNP/snp_summary.cgi">dbSNP 153</a>. </p>

            <p className="regulomehelp-question" id="regulomehelp-faq9-question">
                <strong><i className="icon icon-caret-right" />What version of the human genome sequence are the data mapped to at RegulomeDB?</strong>
            </p>
            <p className="regulomehelp-answer" id="regulomehelp-faq9-answer">All data at RegulomeDB is currently mapped to hg19. Additional information about the human reference genome can be found at the <a href="http://www.ncbi.nlm.nih.gov/projects/genome/assembly/grc/">Genome Reference Consortium</a>.
            </p>

            <p className="regulomehelp-question" id="regulomehelp-faq10-question">
                <strong><i className="icon icon-caret-right" />Why is there no data for my chromosomal region?</strong>
            </p>
            <div className="regulomehelp-answer" id="regulomehelp-faq10-answer">
                <p>Entering a chromosomal region will identify all common SNPs (with an allele frequency &gt; 1%) in that region. These SNPs are used to query RegulomeDB. If there are no common SNPs in the uploaded genomic regions, there will be no      dataavailable. However, the chromosomal region can be uploaded as split single nucleotide values in order to query each nucleotide individually.</p>
                <p>Alternatively, the region you entered could be in a protein-coding region of the genome. Currently, RegulomeDB only integrates and curates high-throughput data from non-coding and intergenic regions of the human genome.</p>
            </div>
        </div>

        <p className="citation"><strong>To cite RegulomeDB:</strong><br /> Boyle AP, Hong EL, Hariharan M, Cheng Y, Schaub MA, Kasowski M, Karczewski KJ, Park J, Hitz BC, Weng S, Cherry JM, Snyder M. Annotation of functional variation in personal genomes  usingRegulomeDB. Genome Research 2012, 22(9):1790-1797. PMID: 22955989.</p><p><strong>To contact RegulomeDB:</strong><br /> <a data-reactid="104" href="mailto:regulomedb@mailman.stanford.edu">regulomedb@mailman.stanford.edu</a>&nbsp;</p>
    </div>
);

export default RegulomeHelp;

globals.contentViews.register(RegulomeHelp, 'regulome-help');
